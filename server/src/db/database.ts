import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

// Ensure data directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open SQLite database
export const db = new Database(config.databasePath);

// Enable WAL mode and foreign key enforcement for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

/**
 * Initialize database schema and execute non-destructive migrations
 */
export function initDatabase(): void {
  // 1. Ensure core tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'processing', 'ready', 'failed'
      error_message TEXT,
      chunk_count INTEGER DEFAULT 0,
      character_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      page_number INTEGER,
      char_start INTEGER,
      char_end INTEGER,
      token_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      document_filter_ids TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL, -- 'user', 'assistant'
      content TEXT NOT NULL,
      sources TEXT, -- JSON array of citation objects
      insufficient_evidence INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS study_plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      daily_available_hours REAL NOT NULL,
      preferred_session_minutes INTEGER NOT NULL,
      target_topics TEXT, -- JSON array of strings
      difficult_topics TEXT, -- JSON array of strings
      document_ids TEXT, -- JSON array of document IDs
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      planned_date TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      priority TEXT NOT NULL, -- 'high', 'medium', 'low'
      is_completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      topic TEXT,
      total_questions INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question_index INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      options TEXT NOT NULL, -- JSON array of strings
      correct_option_index INTEGER NOT NULL,
      explanation TEXT NOT NULL,
      source_chunk_id TEXT REFERENCES document_chunks(id) ON DELETE SET NULL,
      source_document_name TEXT,
      source_page_number INTEGER,
      source_snippet TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      percentage REAL NOT NULL,
      answers TEXT NOT NULL, -- JSON array of user answers
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_doc_index ON document_chunks(document_id, chunk_index);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_plan_id ON study_sessions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_planned_date ON study_sessions(planned_date);
    CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
  `);

  // 2. Safe migrations for Milestone 3, 4 & 5
  migrateSchema();
}

function migrateSchema(): void {
  // Check existing columns on document_chunks
  const chunkColumns = (db.pragma('table_info(document_chunks)') as Array<{ name: string }>).map(c => c.name);

  if (!chunkColumns.includes('embedding')) {
    db.exec(`ALTER TABLE document_chunks ADD COLUMN embedding BLOB;`);
  }
  if (!chunkColumns.includes('embedding_model')) {
    db.exec(`ALTER TABLE document_chunks ADD COLUMN embedding_model TEXT;`);
  }
  if (!chunkColumns.includes('embedding_dim')) {
    db.exec(`ALTER TABLE document_chunks ADD COLUMN embedding_dim INTEGER;`);
  }
  if (!chunkColumns.includes('embedded_at')) {
    db.exec(`ALTER TABLE document_chunks ADD COLUMN embedded_at DATETIME;`);
  }

  // Check existing columns on documents
  const docColumns = (db.pragma('table_info(documents)') as Array<{ name: string }>).map(c => c.name);

  if (!docColumns.includes('embedding_status')) {
    db.exec(`ALTER TABLE documents ADD COLUMN embedding_status TEXT DEFAULT 'pending';`);
  }
  if (!docColumns.includes('embedding_model')) {
    db.exec(`ALTER TABLE documents ADD COLUMN embedding_model TEXT;`);
  }
}
