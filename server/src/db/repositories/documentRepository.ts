import { db } from '../database';

export interface DocumentRecord {
  id: string;
  filename: string;
  stored_filename: string;
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

export type DocumentSummary = Omit<DocumentRecord, 'stored_filename'>;

export interface ChunkRecord {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  char_start: number;
  char_end: number;
  token_count: number;
  embedding?: Float32Array | null;
  embedding_model?: string | null;
  embedding_dim?: number | null;
  embedded_at?: string | null;
  created_at: string;
}

export interface ChunkWithEmbeddingRecord {
  id: string;
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  char_start: number;
  char_end: number;
  token_count: number;
  embedding: Float32Array;
  embedding_model: string;
  embedding_dim: number;
}

export interface NewDocument {
  id: string;
  filename: string;
  stored_filename: string;
  file_type: 'pdf' | 'txt';
  file_size: number;
  status: 'processing' | 'ready' | 'failed';
}

export interface NewChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number?: number | null;
  char_start: number;
  char_end: number;
  token_count: number;
}

// Float32Array <-> Buffer BLOB serialization
export function vectorToBlob(embedding: Float32Array | number[]): Buffer {
  const f32 = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

export function blobToVector(buffer: Buffer): Float32Array {
  const copy = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Float32Array(copy);
}

export const documentRepository = {
  create(doc: NewDocument): DocumentRecord {
    const stmt = db.prepare(`
      INSERT INTO documents (id, filename, stored_filename, file_type, file_size, status, embedding_status)
      VALUES (@id, @filename, @stored_filename, @file_type, @file_size, @status, 'pending')
    `);
    stmt.run(doc);
    return this.getById(doc.id)!;
  },

  updateStatus(
    id: string,
    status: 'ready' | 'failed',
    options?: { errorMessage?: string; chunkCount?: number; characterCount?: number }
  ): void {
    const stmt = db.prepare(`
      UPDATE documents
      SET status = @status,
          error_message = @errorMessage,
          chunk_count = COALESCE(@chunkCount, chunk_count),
          character_count = COALESCE(@characterCount, character_count),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    stmt.run({
      id,
      status,
      errorMessage: options?.errorMessage || null,
      chunkCount: options?.chunkCount ?? null,
      characterCount: options?.characterCount ?? null,
    });
  },

  updateEmbeddingStatus(id: string, status: 'pending' | 'completed' | 'failed', model?: string): void {
    const stmt = db.prepare(`
      UPDATE documents
      SET embedding_status = @status,
          embedding_model = COALESCE(@model, embedding_model),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    stmt.run({ id, status, model: model || null });
  },

  insertChunks(chunks: NewChunk[]): void {
    if (chunks.length === 0) return;

    const insertStmt = db.prepare(`
      INSERT INTO document_chunks (
        id, document_id, chunk_index, content, page_number, char_start, char_end, token_count
      ) VALUES (
        @id, @document_id, @chunk_index, @content, @page_number, @char_start, @char_end, @token_count
      )
    `);

    const insertMany = db.transaction((items: NewChunk[]) => {
      for (const item of items) {
        insertStmt.run({
          ...item,
          page_number: item.page_number ?? null,
        });
      }
    });

    insertMany(chunks);
  },

  saveBatchEmbeddings(
    items: Array<{ chunkId: string; embedding: Float32Array | number[]; model: string; dim: number }>
  ): void {
    if (items.length === 0) return;

    const stmt = db.prepare(`
      UPDATE document_chunks
      SET embedding = @embeddingBlob,
          embedding_model = @model,
          embedding_dim = @dim,
          embedded_at = CURRENT_TIMESTAMP
      WHERE id = @chunkId
    `);

    const tx = db.transaction((rows: typeof items) => {
      for (const row of rows) {
        stmt.run({
          chunkId: row.chunkId,
          embeddingBlob: vectorToBlob(row.embedding),
          model: row.model,
          dim: row.dim,
        });
      }
    });

    tx(items);
  },

  getChunksForDocument(documentId: string): Array<{ id: string; content: string; chunk_index: number; page_number: number | null }> {
    const stmt = db.prepare(`
      SELECT id, content, chunk_index, page_number FROM document_chunks
      WHERE document_id = ?
      ORDER BY chunk_index ASC
    `);
    return stmt.all(documentId) as Array<{ id: string; content: string; chunk_index: number; page_number: number | null }>;
  },

  getUnembeddedChunks(documentId?: string): Array<{ id: string; document_id: string; content: string; chunk_index: number }> {
    if (documentId) {
      const stmt = db.prepare(`
        SELECT id, document_id, content, chunk_index FROM document_chunks
        WHERE document_id = ? AND (embedding IS NULL OR embedding_dim IS NULL)
        ORDER BY chunk_index ASC
      `);
      return stmt.all(documentId) as any[];
    } else {
      const stmt = db.prepare(`
        SELECT id, document_id, content, chunk_index FROM document_chunks
        WHERE (embedding IS NULL OR embedding_dim IS NULL)
        ORDER BY document_id, chunk_index ASC
      `);
      return stmt.all() as any[];
    }
  },

  getChunksWithEmbeddings(documentIds?: string[]): ChunkWithEmbeddingRecord[] {
    let query = `
      SELECT 
        c.id, c.document_id, d.filename, c.chunk_index, c.content,
        c.page_number, c.char_start, c.char_end, c.token_count,
        c.embedding, c.embedding_model, c.embedding_dim
      FROM document_chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
        AND c.embedding_dim IS NOT NULL
        AND d.status = 'ready'
    `;

    const params: any[] = [];
    if (documentIds && documentIds.length > 0) {
      const placeholders = documentIds.map(() => '?').join(',');
      query += ` AND c.document_id IN (${placeholders})`;
      params.push(...documentIds);
    }

    query += ` ORDER BY c.document_id, c.chunk_index ASC`;

    const rows = db.prepare(query).all(...params) as Array<{
      id: string;
      document_id: string;
      filename: string;
      chunk_index: number;
      content: string;
      page_number: number | null;
      char_start: number;
      char_end: number;
      token_count: number;
      embedding: Buffer;
      embedding_model: string;
      embedding_dim: number;
    }>;

    return rows.map(r => ({
      ...r,
      embedding: blobToVector(r.embedding),
    }));
  },

  listSummaries(): DocumentSummary[] {
    const stmt = db.prepare(`
      SELECT id, filename, file_type, file_size, status, error_message, chunk_count, character_count, embedding_status, embedding_model, created_at, updated_at
      FROM documents
      ORDER BY created_at DESC
    `);
    return stmt.all() as DocumentSummary[];
  },

  getById(id: string): DocumentRecord | null {
    const stmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
    const result = stmt.get(id);
    return (result as DocumentRecord) || null;
  },

  getSummaryWithChunks(id: string): { document: DocumentSummary; chunks: ChunkRecord[] } | null {
    const doc = this.getById(id);
    if (!doc) return null;

    const chunksStmt = db.prepare(`
      SELECT id, document_id, chunk_index, content, page_number, char_start, char_end, token_count,
             embedding_model, embedding_dim, embedded_at, created_at
      FROM document_chunks
      WHERE document_id = ?
      ORDER BY chunk_index ASC
    `);
    const chunks = chunksStmt.all(id) as ChunkRecord[];

    const { stored_filename, ...summary } = doc;
    return {
      document: summary,
      chunks,
    };
  },

  delete(id: string): DocumentRecord | null {
    const doc = this.getById(id);
    if (!doc) return null;

    // Delete in transaction (cascades to chunks via foreign key)
    const deleteTx = db.transaction((docId: string) => {
      db.prepare(`DELETE FROM documents WHERE id = ?`).run(docId);
    });
    deleteTx(id);

    return doc;
  },
};
