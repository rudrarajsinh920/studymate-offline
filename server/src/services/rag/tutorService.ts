import { randomUUID } from 'crypto';
import { config } from '../../config';
import { ILlmProvider } from '../ai/ILlmProvider';
import { OllamaLlmProvider } from '../ai/OllamaLlmProvider';
import { RetrievalService, retrievalService, SearchResultItem } from './retrievalService';
import { chatRepository, CitationSource, ChatSessionRecord } from '../../db/repositories/chatRepository';
import { AskQuestionRequest, AskQuestionResponse, ExplanationMode } from 'studymate-shared';

export interface GroundedAnswerResult {
  answer: string;
  sources: CitationSource[];
  insufficientEvidence: boolean;
  explanationMode: ExplanationMode;
  model: string;
  sessionId: string;
  userMessageId: string;
  assistantMessageId: string;
}

export class TutorService {
  private readonly llmProvider: ILlmProvider;
  private readonly retrievalService: RetrievalService;

  // Minimum cosine similarity to consider evidence relevant
  private readonly defaultMinScore = 0.28;

  constructor(llmProvider?: ILlmProvider, retrieval?: RetrievalService) {
    this.llmProvider = llmProvider || new OllamaLlmProvider();
    this.retrievalService = retrieval || retrievalService;
  }

  public getLlmProvider(): ILlmProvider {
    return this.llmProvider;
  }

  /**
   * Generates a grounded, citation-backed tutor explanation for a student's question.
   */
  public async answerQuestion(params: AskQuestionRequest): Promise<GroundedAnswerResult> {
    const rawQuestion = (params.question || '').trim();
    if (!rawQuestion) {
      throw new Error('Question must not be empty.');
    }

    const explanationMode: ExplanationMode = params.explanationMode || 'standard';
    const topK = Math.min(Math.max(1, params.topK ?? 3), 10);

    // 1. Resolve or initialize chat session
    let activeSessionId: string;
    let session: ChatSessionRecord | null = null;

    if (params.sessionId) {
      session = chatRepository.getSessionSummary(params.sessionId);
    }

    if (session) {
      activeSessionId = session.id;
    } else {
      activeSessionId = randomUUID();
      const title = rawQuestion.length > 50 ? `${rawQuestion.slice(0, 47)}...` : rawQuestion;
      session = chatRepository.createSession(activeSessionId, title, params.documentIds);
    }

    // 2. Persist student's question in session history
    const userMsgId = randomUUID();
    chatRepository.addMessage(userMsgId, activeSessionId, 'user', rawQuestion);

    // 3. Retrieve relevant document chunks using local semantic search
    let searchResults: SearchResultItem[] = [];
    try {
      const searchRes = await this.retrievalService.searchSimilar({
        query: rawQuestion,
        documentIds: params.documentIds,
        topK,
        minScore: this.defaultMinScore,
      });
      searchResults = searchRes.results;
    } catch (err: unknown) {
      // Re-throw embedding errors or configuration errors
      throw err;
    }

    // 4. Check for insufficient evidence before LLM generation
    if (searchResults.length === 0) {
      const fallbackAnswer =
        'I cannot find sufficient evidence in your uploaded study notes to answer this question. Please ensure relevant notes are uploaded and processed, or try rephrasing your question.';
      
      const assistantMsgId = randomUUID();
      chatRepository.addMessage(assistantMsgId, activeSessionId, 'assistant', fallbackAnswer, [], true);

      return {
        answer: fallbackAnswer,
        sources: [],
        insufficientEvidence: true,
        explanationMode,
        model: this.llmProvider.getModelName(),
        sessionId: activeSessionId,
        userMessageId: userMsgId,
        assistantMessageId: assistantMsgId,
      };
    }

    // 5. Construct structured citation sources
    const citations: CitationSource[] = searchResults.map((chunk, index) => ({
      citationIndex: index + 1,
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
      snippet: chunk.content,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
    }));

    // 6. Format context passages for prompt
    const formattedPassages = citations
      .map((c) => {
        const pageInfo = c.pageNumber !== null ? ` (Page ${c.pageNumber})` : '';
        return `[Source ${c.citationIndex}] Document: "${c.documentName}"${pageInfo}, Chunk #${c.chunkIndex}:\n"${c.snippet.trim()}"`;
      })
      .join('\n\n');

    // 7. Build grounding prompt with strict guardrails
    const systemPrompt = this.buildSystemPrompt(explanationMode);
    const userPrompt = this.buildUserPrompt(rawQuestion, formattedPassages, explanationMode);

    // 8. Invoke local LLM for generation
    let generatedText: string;
    try {
      // Allocate token budget according to requested explanation mode capped by config
      let tokenBudget = config.ollama.maxTokens;
      if (explanationMode === 'concise') {
        tokenBudget = Math.min(256, config.ollama.maxTokens);
      } else if (explanationMode === 'simple') {
        tokenBudget = Math.min(384, config.ollama.maxTokens);
      }

      generatedText = await this.llmProvider.generate(userPrompt, {
        systemPrompt,
        temperature: 0.1, // Low temperature for high factual precision
        maxTokens: tokenBudget,
        timeoutMs: config.ollama.timeoutMs,
      });
    } catch (err: unknown) {
      throw err;
    }

    // 9. Inspect if response indicates insufficient evidence
    const isInsufficient = this.detectInsufficientEvidence(generatedText);

    // 10. Check which sources were cited
    const finalSources = isInsufficient ? [] : citations;

    // 11. Persist assistant response
    const assistantMsgId = randomUUID();
    chatRepository.addMessage(
      assistantMsgId,
      activeSessionId,
      'assistant',
      generatedText,
      finalSources,
      isInsufficient
    );

    return {
      answer: generatedText,
      sources: finalSources,
      insufficientEvidence: isInsufficient,
      explanationMode,
      model: this.llmProvider.getModelName(),
      sessionId: activeSessionId,
      userMessageId: userMsgId,
      assistantMessageId: assistantMsgId,
    };
  }

  private buildSystemPrompt(mode: ExplanationMode): string {
    const styleInstructions: Record<ExplanationMode, string> = {
      standard:
        'Deliver a well-structured, clear explanation. Highlight key concepts and logical reasoning. Use source citation tags like [Source 1], [Source 2] for all asserted facts.',
      concise:
        'Deliver a direct, high-yield summary in 2 to 4 sentences without filler or preamble. Use source citations like [Source 1] for key facts.',
      simple:
        'Explain in simple, beginner-friendly terms with intuitive analogies and plain vocabulary so any student can easily grasp the concept. Maintain factual accuracy and cite sources like [Source 1].',
    };

    return `You are StudyMate, an offline AI study companion and academic tutor.
Your duty is to answer student questions based EXCLUSIVELY on the provided excerpts from their uploaded notes.

MANDATORY GROUNDING RULES:
1. ONLY use information explicitly stated in the "STUDY CONTEXT PASSAGES" below.
2. DO NOT use pre-trained external knowledge, facts, or assumptions outside of the provided context.
3. If the context passages do not contain enough facts to answer the question accurately, you MUST explicitly respond with: "The uploaded study notes do not contain enough information to answer this question." Do NOT guess or invent answers.
4. For every factual claim, definition, or point you write, append the relevant source reference tag: [Source 1], [Source 2], etc.
5. NEVER invent citations, page numbers, author names, or document titles. Only cite the numbers provided in the context passages.
6. Tone & Style Mode: ${styleInstructions[mode]}`;
  }

  private buildUserPrompt(
    question: string,
    passages: string,
    mode: ExplanationMode
  ): string {
    return `STUDY CONTEXT PASSAGES:
${passages}

-----------------------
STUDENT QUESTION:
${question}

EXPLANATION MODE: ${mode}

Please provide your grounded tutor explanation with [Source N] citations:`;
  }

  private detectInsufficientEvidence(text: string): boolean {
    const lower = text.toLowerCase();
    const markers = [
      'do not contain enough information',
      'does not contain enough information',
      'not contain enough information',
      'cannot find enough information',
      'not mentioned in the provided',
      'not mentioned in the uploaded',
      'the provided notes do not contain',
      'the uploaded notes do not contain',
      'the notes do not contain',
      'insufficient information',
      'not enough information in the provided',
      'cannot be answered using the provided notes',
    ];

    return markers.some((m) => lower.includes(m));
  }
}

export const tutorService = new TutorService();
