// Common shared types for StudyMate Offline

export interface ApiHealthResponse {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  server: {
    port: number;
    nodeVersion: string;
  };
  ollama: {
    connected: boolean;
    baseUrl: string;
    configuredModels: {
      llm: string;
      embed: string;
    };
    detectedModels: string[];
    hasConfiguredLlm: boolean;
    hasConfiguredEmbed: boolean;
    message?: string;
    latencyMs?: number;
  };
}

export interface DocumentSummary {
  id: string;
  filename: string;
  file_type: 'pdf' | 'txt';
  file_size: number;
  status: 'processing' | 'ready' | 'failed';
  error_message: string | null;
  chunk_count: number;
  character_count: number;
  embedding_status: 'pending' | 'completed' | 'failed';
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChunkRecord {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  char_start: number;
  char_end: number;
  token_count: number;
  embedding_model?: string | null;
  embedding_dim?: number | null;
  embedded_at?: string | null;
  created_at: string;
}

export interface DocumentDetailResponse {
  document: DocumentSummary;
  chunks: ChunkRecord[];
}

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  chunkIndex: number;
  score: number;
  content: string;
  charStart: number;
  charEnd: number;
  tokenCount: number;
}

export interface SearchResponse {
  query: string;
  model: string;
  dimension: number;
  totalCandidates: number;
  results: SearchResultItem[];
}

export interface SearchRequest {
  query: string;
  documentIds?: string[];
  topK?: number;
  minScore?: number;
}

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
}

export interface CreateSessionRequest {
  title?: string;
  documentFilterIds?: string[];
}

// ============================================================================
// Milestone 5: Study Planner & Quizzes Shared Contracts
// ============================================================================

export type PriorityLevel = 'high' | 'medium' | 'low';

export interface StudySessionRecord {
  id: string;
  plan_id: string;
  title: string;
  topic: string;
  planned_date: string; // YYYY-MM-DD
  duration_minutes: number;
  priority: PriorityLevel;
  is_completed: boolean;
  completed_at: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyPlanRecord {
  id: string;
  title: string;
  exam_date: string; // YYYY-MM-DD
  daily_available_hours: number;
  preferred_session_minutes: number;
  target_topics: string[];
  difficult_topics: string[];
  document_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface StudyPlanWithSessions extends StudyPlanRecord {
  sessions: StudySessionRecord[];
  totalSessions: number;
  completedSessions: number;
  totalStudyMinutes: number;
  completedMinutes: number;
}

export interface CreatePlanRequest {
  title?: string;
  examDate: string; // YYYY-MM-DD
  dailyAvailableHours: number;
  preferredSessionMinutes?: number;
  topics?: string[];
  difficultTopics?: string[];
  documentIds?: string[];
}

export interface UpdateSessionRequest {
  title?: string;
  plannedDate?: string;
  durationMinutes?: number;
  priority?: PriorityLevel;
  isCompleted?: boolean;
}

export interface QuizQuestionRecord {
  id: string;
  quiz_id: string;
  question_index: number;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  source_chunk_id: string | null;
  source_document_name: string | null;
  source_page_number: number | null;
  source_snippet: string | null;
  created_at: string;
}

export interface QuizRecord {
  id: string;
  title: string;
  document_id: string | null;
  topic: string | null;
  total_questions: number;
  created_at: string;
}

export interface QuizWithQuestions extends QuizRecord {
  questions: QuizQuestionRecord[];
}

export interface QuizAttemptAnswer {
  questionId: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
}

export interface QuizAttemptRecord {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  answers: QuizAttemptAnswer[];
  created_at: string;
}

export interface GenerateQuizRequest {
  documentId?: string;
  topic?: string;
  questionCount?: number;
}

export interface SubmitQuizAttemptRequest {
  answers: Array<{
    questionId: string;
    selectedOptionIndex: number;
  }>;
}

export interface SubmitQuizAttemptResponse {
  attemptId: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  answers: QuizAttemptAnswer[];
  review: Array<{
    questionId: string;
    questionText: string;
    options: string[];
    selectedOptionIndex: number;
    correctOptionIndex: number;
    isCorrect: boolean;
    explanation: string;
    sourceDocumentName: string | null;
    sourcePageNumber: number | null;
    sourceSnippet: string | null;
  }>;
}


