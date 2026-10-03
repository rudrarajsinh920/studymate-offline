import { db } from '../database';
import { 
  QuizRecord, 
  QuizQuestionRecord, 
  QuizWithQuestions, 
  QuizAttemptRecord,
  QuizAttemptAnswer 
} from 'studymate-shared';

interface DbQuestionRow {
  id: string;
  quiz_id: string;
  question_index: number;
  question_text: string;
  options: string;
  correct_option_index: number;
  explanation: string;
  source_chunk_id: string | null;
  source_document_name: string | null;
  source_page_number: number | null;
  source_snippet: string | null;
  created_at: string;
}

interface DbAttemptRow {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  answers: string;
  created_at: string;
}

function parseQuestionRow(row: DbQuestionRow): QuizQuestionRecord {
  return {
    id: row.id,
    quiz_id: row.quiz_id,
    question_index: row.question_index,
    question_text: row.question_text,
    options: JSON.parse(row.options),
    correct_option_index: row.correct_option_index,
    explanation: row.explanation,
    source_chunk_id: row.source_chunk_id,
    source_document_name: row.source_document_name,
    source_page_number: row.source_page_number,
    source_snippet: row.source_snippet,
    created_at: row.created_at,
  };
}

function parseAttemptRow(row: DbAttemptRow): QuizAttemptRecord {
  return {
    id: row.id,
    quiz_id: row.quiz_id,
    score: row.score,
    total_questions: row.total_questions,
    percentage: row.percentage,
    answers: JSON.parse(row.answers),
    created_at: row.created_at,
  };
}

export const quizRepository = {
  createQuizWithQuestions(
    quiz: QuizRecord,
    questions: QuizQuestionRecord[]
  ): QuizWithQuestions {
    const insertQuizStmt = db.prepare(`
      INSERT INTO quizzes (id, title, document_id, topic, total_questions)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertQuestionStmt = db.prepare(`
      INSERT INTO quiz_questions (
        id, quiz_id, question_index, question_text, options,
        correct_option_index, explanation, source_chunk_id,
        source_document_name, source_page_number, source_snippet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      insertQuizStmt.run(
        quiz.id,
        quiz.title,
        quiz.document_id || null,
        quiz.topic || null,
        quiz.total_questions
      );

      for (const q of questions) {
        insertQuestionStmt.run(
          q.id,
          q.quiz_id,
          q.question_index,
          q.question_text,
          JSON.stringify(q.options),
          q.correct_option_index,
          q.explanation,
          q.source_chunk_id || null,
          q.source_document_name || null,
          q.source_page_number ?? null,
          q.source_snippet || null
        );
      }
    });

    tx();
    return this.getQuizWithQuestions(quiz.id)!;
  },

  listQuizzes(): QuizRecord[] {
    const stmt = db.prepare(`SELECT * FROM quizzes ORDER BY created_at DESC`);
    return stmt.all() as QuizRecord[];
  },

  getQuizWithQuestions(quizId: string): QuizWithQuestions | null {
    const quizRow = db.prepare(`SELECT * FROM quizzes WHERE id = ?`).get(quizId) as QuizRecord | undefined;
    if (!quizRow) return null;

    const questionRows = db.prepare(`
      SELECT * FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY question_index ASC
    `).all(quizId) as DbQuestionRow[];

    return {
      ...quizRow,
      questions: questionRows.map(parseQuestionRow),
    };
  },

  deleteQuiz(quizId: string): boolean {
    const res = db.prepare(`DELETE FROM quizzes WHERE id = ?`).run(quizId);
    return res.changes > 0;
  },

  saveAttempt(attempt: QuizAttemptRecord): QuizAttemptRecord {
    db.prepare(`
      INSERT INTO quiz_attempts (id, quiz_id, score, total_questions, percentage, answers)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      attempt.id,
      attempt.quiz_id,
      attempt.score,
      attempt.total_questions,
      attempt.percentage,
      JSON.stringify(attempt.answers)
    );

    return attempt;
  },

  getAttemptsForQuiz(quizId: string): QuizAttemptRecord[] {
    const rows = db.prepare(`
      SELECT * FROM quiz_attempts
      WHERE quiz_id = ?
      ORDER BY created_at DESC
    `).all(quizId) as DbAttemptRow[];
    return rows.map(parseAttemptRow);
  },

  getAttempt(attemptId: string): QuizAttemptRecord | null {
    const row = db.prepare(`SELECT * FROM quiz_attempts WHERE id = ?`).get(attemptId) as DbAttemptRow | undefined;
    return row ? parseAttemptRow(row) : null;
  },
};
