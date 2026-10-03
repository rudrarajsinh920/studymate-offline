import { randomUUID } from 'crypto';
import { 
  QuizRecord, 
  QuizQuestionRecord, 
  QuizWithQuestions, 
  GenerateQuizRequest, 
  SubmitQuizAttemptRequest, 
  SubmitQuizAttemptResponse,
  QuizAttemptRecord,
  QuizAttemptAnswer 
} from 'studymate-shared';
import { quizRepository } from '../../db/repositories/quizRepository';
import { documentRepository } from '../../db/repositories/documentRepository';
import { config } from '../../config';
import { ILlmProvider } from '../ai/ILlmProvider';
import { OllamaLlmProvider } from '../ai/OllamaLlmProvider';
import { RetrievalService, retrievalService } from '../rag/retrievalService';

export class QuizGenerationError extends Error {
  public readonly code?: string;
  public readonly instructions?: string;

  constructor(message: string, code?: string, instructions?: string) {
    super(message);
    this.name = 'QuizGenerationError';
    this.code = code;
    this.instructions = instructions;
  }
}

interface RawLlmQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceIndex: number;
}

interface RawLlmQuizOutput {
  title?: string;
  questions: RawLlmQuestion[];
}

export class QuizService {
  private readonly llmProvider: ILlmProvider;
  private readonly retrievalService: RetrievalService;

  constructor(llmProvider?: ILlmProvider, retrieval?: RetrievalService) {
    this.llmProvider = llmProvider || new OllamaLlmProvider();
    this.retrievalService = retrieval || retrievalService;
  }

  public getLlmProvider(): ILlmProvider {
    return this.llmProvider;
  }

  /**
   * Generates a grounded multiple-choice quiz based on notes passages.
   */
  public async generateQuiz(req: GenerateQuizRequest): Promise<QuizWithQuestions> {
    const questionCount = Math.min(Math.max(1, req.questionCount || 5), 10);

    // 1. Collect candidate study passages
    interface CandidateChunk {
      chunkId: string;
      documentId: string;
      documentName: string;
      pageNumber: number | null;
      chunkIndex: number;
      content: string;
    }

    let candidateChunks: CandidateChunk[] = [];

    if (req.documentId) {
      const doc = documentRepository.getById(req.documentId);
      if (!doc) {
        throw new QuizGenerationError(`Document with ID '${req.documentId}' not found.`);
      }

      const chunks = documentRepository.getChunksForDocument(req.documentId);
      candidateChunks = chunks.map((c) => ({
        chunkId: c.id,
        documentId: req.documentId!,
        documentName: doc.filename,
        pageNumber: c.page_number ?? null,
        chunkIndex: c.chunk_index,
        content: c.content,
      }));
    } else if (req.topic) {
      const searchRes = await this.retrievalService.searchSimilar({
        query: req.topic,
        topK: questionCount * 2,
        minScore: 0.25,
      });

      candidateChunks = searchRes.results.map((r) => ({
        chunkId: r.chunkId,
        documentId: r.documentId,
        documentName: r.documentName,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex,
        content: r.content,
      }));
    } else {
      const allCandidateEmbeddings = documentRepository.getChunksWithEmbeddings();
      candidateChunks = allCandidateEmbeddings.map((r) => ({
        chunkId: r.id,
        documentId: r.document_id,
        documentName: r.filename,
        pageNumber: r.page_number,
        chunkIndex: r.chunk_index,
        content: r.content,
      }));
    }

    // 2. Validate source evidence sufficiency
    if (candidateChunks.length === 0) {
      throw new QuizGenerationError(
        'Insufficient study material to generate a quiz. Please upload notes or select a document containing text.'
      );
    }

    // Select focused representative chunks (up to 5 or questionCount + 2)
    const selectedPassages = candidateChunks.slice(0, Math.min(questionCount + 2, 5));

    // 3. Format passages with source numbering
    const formattedPassages = selectedPassages
      .map((c, i) => {
        const pageInfo = c.pageNumber !== null ? ` (Page ${c.pageNumber})` : '';
        return `[Source ${i + 1}] Document: "${c.documentName}"${pageInfo}:\n"${c.content.trim()}"`;
      })
      .join('\n\n');

    // 4. Build prompt demanding strict JSON multiple choice format
    const systemPrompt = `You are an expert academic tutor for StudyMate.
Generate exactly ${questionCount} high-yield multiple-choice questions (MCQs) derived STRICTLY from the provided STUDY PASSAGES.

CRITICAL GROUNDING RULES:
1. Every question must test a factual statement or definition present in the passages.
2. DO NOT introduce outside facts, unsupported names, or imaginary numbers.
3. Each question MUST provide exactly 4 distinct options (array of strings).
4. Provide "correctIndex" (0, 1, 2, or 3) indicating which option is correct.
5. Provide a clear, educational "explanation" citing the facts.
6. Provide "sourceIndex" as an integer (e.g. 1 for [Source 1]) indicating the passage used.
7. Return PURE JSON with NO code block formatting, markdown, or text outside the JSON object:
{
  "title": "Topic or Concept Title",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctIndex": 0,
      "explanation": "Explanation why Option 1 is correct based on the passage...",
      "sourceIndex": 1
    }
  ]
}`;

    const userPrompt = `STUDY PASSAGES:
${formattedPassages}

Generate ${questionCount} grounded multiple-choice questions in strict JSON format:`;

    // 5. Invoke LLM with generation
    let rawResponse = '';
    try {
      rawResponse = await this.llmProvider.generate(userPrompt, {
        systemPrompt,
        temperature: 0.1,
        maxTokens: Math.max(config.ollama.maxTokens, 1024),
        timeoutMs: config.ollama.timeoutMs,
      });
    } catch (err: unknown) {
      throw err;
    }

    // 6. Parse and validate JSON structure
    const parsedQuiz = this.extractJsonFromResponse(rawResponse);
    if (!parsedQuiz || !Array.isArray(parsedQuiz.questions) || parsedQuiz.questions.length === 0) {
      throw new QuizGenerationError(
        'Failed to generate valid quiz questions from the local language model. Please try again.'
      );
    }

    const quizId = randomUUID();
    const quizTitle = parsedQuiz.title || (req.topic ? `Quiz on ${req.topic}` : 'Study Notes Practice Quiz');

    // 7. Map questions to verified sources
    const questionsToSave: QuizQuestionRecord[] = [];

    for (let i = 0; i < parsedQuiz.questions.length; i++) {
      const q = parsedQuiz.questions[i];
      if (!q.question || !Array.isArray(q.options) || q.options.length < 2) {
        continue;
      }

      // Pad or trim options to exactly 4 choices
      let options = q.options.slice(0, 4);
      while (options.length < 4) {
        options.push(`Alternative ${options.length + 1}`);
      }

      let correctIndex = Number(q.correctIndex);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        correctIndex = 0;
      }

      // Resolve source passage
      const srcIdx = Number(q.sourceIndex);
      const matchedChunk = (srcIdx >= 1 && srcIdx <= selectedPassages.length)
        ? selectedPassages[srcIdx - 1]
        : selectedPassages[0];

      questionsToSave.push({
        id: randomUUID(),
        quiz_id: quizId,
        question_index: i,
        question_text: q.question.trim(),
        options,
        correct_option_index: correctIndex,
        explanation: q.explanation || 'Verified from course notes.',
        source_chunk_id: matchedChunk?.chunkId || null,
        source_document_name: matchedChunk?.documentName || null,
        source_page_number: matchedChunk?.pageNumber ?? null,
        source_snippet: matchedChunk?.content ? matchedChunk.content.slice(0, 300) : null,
        created_at: new Date().toISOString(),
      });
    }

    if (questionsToSave.length === 0) {
      throw new QuizGenerationError('Model generated no valid questions. Please retry.');
    }

    // 8. Persist in SQLite
    const quizRecord: QuizRecord = {
      id: quizId,
      title: quizTitle,
      document_id: req.documentId || null,
      topic: req.topic || null,
      total_questions: questionsToSave.length,
      created_at: new Date().toISOString(),
    };

    return quizRepository.createQuizWithQuestions(quizRecord, questionsToSave);
  }

  /**
   * Evaluates student's submitted quiz answers and records score in SQLite.
   */
  public submitAttempt(quizId: string, req: SubmitQuizAttemptRequest): SubmitQuizAttemptResponse {
    const quiz = quizRepository.getQuizWithQuestions(quizId);
    if (!quiz) {
      throw new QuizGenerationError(`Quiz with ID '${quizId}' was not found.`);
    }

    const userAnswersMap = new Map<string, number>();
    for (const ans of req.answers || []) {
      userAnswersMap.set(ans.questionId, ans.selectedOptionIndex);
    }

    let correctCount = 0;
    const evaluatedAnswers: QuizAttemptAnswer[] = [];
    const reviewItems: SubmitQuizAttemptResponse['review'] = [];

    for (const q of quiz.questions) {
      const selectedIndex = userAnswersMap.has(q.id) ? userAnswersMap.get(q.id)! : -1;
      const isCorrect = selectedIndex === q.correct_option_index;

      if (isCorrect) {
        correctCount++;
      }

      evaluatedAnswers.push({
        questionId: q.id,
        selectedOptionIndex: selectedIndex,
        isCorrect,
      });

      reviewItems.push({
        questionId: q.id,
        questionText: q.question_text,
        options: q.options,
        selectedOptionIndex: selectedIndex,
        correctOptionIndex: q.correct_option_index,
        isCorrect,
        explanation: q.explanation,
        sourceDocumentName: q.source_document_name,
        sourcePageNumber: q.source_page_number,
        sourceSnippet: q.source_snippet,
      });
    }

    const totalQuestions = quiz.questions.length;
    const percentage = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(1)) : 0;
    const attemptId = randomUUID();

    const attemptRecord: QuizAttemptRecord = {
      id: attemptId,
      quiz_id: quizId,
      score: correctCount,
      total_questions: totalQuestions,
      percentage,
      answers: evaluatedAnswers,
      created_at: new Date().toISOString(),
    };

    quizRepository.saveAttempt(attemptRecord);

    return {
      attemptId,
      quizId,
      score: correctCount,
      totalQuestions,
      percentage,
      answers: evaluatedAnswers,
      review: reviewItems,
    };
  }

  public listQuizzes(): QuizRecord[] {
    return quizRepository.listQuizzes();
  }

  public getQuiz(quizId: string): QuizWithQuestions | null {
    return quizRepository.getQuizWithQuestions(quizId);
  }

  public deleteQuiz(quizId: string): boolean {
    return quizRepository.deleteQuiz(quizId);
  }

  public getQuizAttempts(quizId: string): QuizAttemptRecord[] {
    return quizRepository.getAttemptsForQuiz(quizId);
  }

  private extractJsonFromResponse(text: string): RawLlmQuizOutput | null {
    try {
      // 1. Direct parse attempt
      return JSON.parse(text);
    } catch {
      // 2. Extract content between first { and last }
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = text.substring(start, end + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

export const quizService = new QuizService();
