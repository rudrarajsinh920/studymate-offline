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

export async function searchSimilarChunks(req: SearchRequest): Promise<SearchResponse> {
  const response = await fetch('/api/retrieval/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `Search failed with status ${response.status}`;
    const err = new Error(message);
    (err as any).instructions = errorData.instructions;
    (err as any).code = errorData.code;
    throw err;
  }

  return response.json();
}

export async function embedSingleDocument(id: string): Promise<any> {
  const response = await fetch(`/api/documents/${id}/embed`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(errorData.error || `Embedding failed with status ${response.status}`);
    (err as any).instructions = errorData.instructions;
    throw err;
  }

  return response.json();
}

export async function embedAllPending(): Promise<any> {
  const response = await fetch('/api/documents/embed-all', {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(errorData.error || `Embedding all failed with status ${response.status}`);
    (err as any).instructions = errorData.instructions;
    throw err;
  }

  return response.json();
}
