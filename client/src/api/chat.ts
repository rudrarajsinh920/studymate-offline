export type ExplanationMode = 'standard' | 'concise' | 'simple';

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

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: CitationSource[] | null;
  insufficient_evidence: boolean;
  created_at: string;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  document_filter_ids: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionWithMessages extends ChatSessionRecord {
  messages: ChatMessageRecord[];
}

export interface AskQuestionRequest {
  question: string;
  sessionId?: string;
  documentIds?: string[];
  explanationMode?: ExplanationMode;
  topK?: number;
}

export interface AskQuestionResponse {
  answer: string;
  sessionId: string;
  messageId: string;
  sources: CitationSource[];
  insufficientEvidence: boolean;
  explanationMode: ExplanationMode;
  model: string;
  userMessageId: string;
  assistantMessageId: string;
}

export interface CreateSessionRequest {
  title?: string;
  documentFilterIds?: string[];
}

export class ChatApiError extends Error {
  public code?: string;
  public instructions?: string;

  constructor(message: string, code?: string, instructions?: string) {
    super(message);
    this.name = 'ChatApiError';
    this.code = code;
    this.instructions = instructions;
  }
}

/**
 * Send student question to local grounded tutor.
 */
export async function askQuestion(req: AskQuestionRequest): Promise<AskQuestionResponse> {
  const response = await fetch('/api/chat/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `Tutor service request failed (${response.status})`;
    throw new ChatApiError(message, errorData.code, errorData.instructions);
  }

  return response.json();
}

/**
 * List all study chat sessions.
 */
export async function getChatSessions(): Promise<ChatSessionRecord[]> {
  const response = await fetch('/api/chat/sessions');
  if (!response.ok) {
    throw new Error('Failed to load chat sessions');
  }
  return response.json();
}

/**
 * Get single session with conversation history.
 */
export async function getChatSession(id: string): Promise<ChatSessionWithMessages> {
  const response = await fetch(`/api/chat/sessions/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load chat session ${id}`);
  }
  return response.json();
}

/**
 * Create a new chat session.
 */
export async function createChatSession(req: CreateSessionRequest): Promise<ChatSessionRecord> {
  const response = await fetch('/api/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error('Failed to create new chat session');
  }
  return response.json();
}

/**
 * Delete a session and its message history.
 */
export async function deleteChatSession(id: string): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete chat session');
  }
}

/**
 * Clear message history for a session.
 */
export async function clearSessionMessages(id: string): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${id}/messages`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to clear session messages');
  }
}
