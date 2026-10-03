import { db } from '../database';

export interface CitationSource {
  citationIndex: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  chunkIndex: number;
  score: number;
  snippet: string;
  charStart: number;
  charEnd: number;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  document_filter_ids: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: CitationSource[] | null;
  insufficient_evidence: boolean;
  created_at: string;
}

export interface ChatSessionWithMessages extends ChatSessionRecord {
  messages: ChatMessageRecord[];
}

export const chatRepository = {
  createSession(id: string, title: string, documentFilterIds?: string[]): ChatSessionRecord {
    const stmt = db.prepare(`
      INSERT INTO chat_sessions (id, title, document_filter_ids)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, title, documentFilterIds ? JSON.stringify(documentFilterIds) : null);
    return this.getSessionSummary(id)!;
  },

  getSessionSummary(id: string): ChatSessionRecord | null {
    const stmt = db.prepare(`SELECT * FROM chat_sessions WHERE id = ?`);
    const row = stmt.get(id);
    return (row as ChatSessionRecord) || null;
  },

  listSessions(): ChatSessionRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM chat_sessions
      ORDER BY updated_at DESC
    `);
    return stmt.all() as ChatSessionRecord[];
  },

  getSessionWithMessages(id: string): ChatSessionWithMessages | null {
    const session = this.getSessionSummary(id);
    if (!session) return null;

    const messagesStmt = db.prepare(`
      SELECT id, session_id, role, content, sources, insufficient_evidence, created_at
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);
    const rows = messagesStmt.all(id) as Array<{
      id: string;
      session_id: string;
      role: 'user' | 'assistant';
      content: string;
      sources: string | null;
      insufficient_evidence: number;
      created_at: string;
    }>;

    const messages: ChatMessageRecord[] = rows.map((r) => ({
      id: r.id,
      session_id: r.session_id,
      role: r.role,
      content: r.content,
      sources: r.sources ? JSON.parse(r.sources) : null,
      insufficient_evidence: Boolean(r.insufficient_evidence),
      created_at: r.created_at,
    }));

    return {
      ...session,
      messages,
    };
  },

  deleteSession(id: string): boolean {
    const stmt = db.prepare(`DELETE FROM chat_sessions WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  },

  addMessage(
    id: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    sources?: CitationSource[],
    insufficientEvidence: boolean = false
  ): ChatMessageRecord {
    const stmt = db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, sources, insufficient_evidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      sessionId,
      role,
      content,
      sources ? JSON.stringify(sources) : null,
      insufficientEvidence ? 1 : 0
    );

    // Update session timestamp
    db.prepare(`UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

    return {
      id,
      session_id: sessionId,
      role,
      content,
      sources: sources || null,
      insufficient_evidence: insufficientEvidence,
      created_at: new Date().toISOString(),
    };
  },

  clearMessages(sessionId: string): void {
    db.prepare(`DELETE FROM chat_messages WHERE session_id = ?`).run(sessionId);
  },
};
