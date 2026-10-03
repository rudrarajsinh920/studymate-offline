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

export async function getDocuments(): Promise<DocumentSummary[]> {
  const response = await fetch('/api/documents');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch documents (${response.status})`);
  }
  const data = await response.json();
  return data.documents || [];
}

export async function getDocumentDetails(id: string): Promise<DocumentDetailResponse> {
  const response = await fetch(`/api/documents/${id}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch document details (${response.status})`);
  }
  return response.json();
}

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.document;
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Delete failed with status ${response.status}`);
  }
}
