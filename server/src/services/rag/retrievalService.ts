import { documentRepository, ChunkWithEmbeddingRecord } from '../../db/repositories/documentRepository';
import { IEmbeddingProvider } from '../ai/IEmbeddingProvider';
import { OllamaEmbeddingProvider, EmbeddingServiceError } from '../ai/OllamaEmbeddingProvider';
import { cosineSimilarity, DimensionMismatchError } from './vectorMath';

export interface SearchQueryOptions {
  query: string;
  documentIds?: string[];
  topK?: number;
  minScore?: number;
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

export class RetrievalService {
  private readonly embeddingProvider: IEmbeddingProvider;

  constructor(embeddingProvider?: IEmbeddingProvider) {
    this.embeddingProvider = embeddingProvider || new OllamaEmbeddingProvider();
  }

  public getEmbeddingProvider(): IEmbeddingProvider {
    return this.embeddingProvider;
  }

  /**
   * Generates and persists embeddings for all chunks of a specific document in SQLite.
   */
  public async embedDocumentChunks(documentId: string): Promise<{ embeddedCount: number; model: string; dimension: number }> {
    const doc = documentRepository.getById(documentId);
    if (!doc) {
      throw new Error(`Document with ID '${documentId}' not found.`);
    }

    const chunks = documentRepository.getChunksForDocument(documentId);
    if (chunks.length === 0) {
      documentRepository.updateEmbeddingStatus(documentId, 'completed');
      return { embeddedCount: 0, model: this.embeddingProvider.getModelName(), dimension: 0 };
    }

    const texts = chunks.map((c) => c.content);
    const vectors = await this.embeddingProvider.embedBatch(texts);

    if (vectors.length !== chunks.length) {
      throw new Error(`Mismatch in generated embeddings: expected ${chunks.length}, got ${vectors.length}`);
    }

    const dimension = vectors[0]?.length || 0;
    const modelName = this.embeddingProvider.getModelName();

    const itemsToSave = chunks.map((chunk, index) => ({
      chunkId: chunk.id,
      embedding: vectors[index],
      model: modelName,
      dim: dimension,
    }));

    documentRepository.saveBatchEmbeddings(itemsToSave);
    documentRepository.updateEmbeddingStatus(documentId, 'completed', modelName);

    return {
      embeddedCount: itemsToSave.length,
      model: modelName,
      dimension,
    };
  }

  /**
   * Scans SQLite for any document chunks missing embeddings and generates them.
   */
  public async backfillPendingEmbeddings(): Promise<{ processedDocs: number; totalChunksEmbedded: number }> {
    const unembeddedChunks = documentRepository.getUnembeddedChunks();
    if (unembeddedChunks.length === 0) {
      return { processedDocs: 0, totalChunksEmbedded: 0 };
    }

    // Group by documentId
    const docMap = new Map<string, Array<{ id: string; content: string }>>();
    for (const chunk of unembeddedChunks) {
      if (!docMap.has(chunk.document_id)) {
        docMap.set(chunk.document_id, []);
      }
      docMap.get(chunk.document_id)!.push({ id: chunk.id, content: chunk.content });
    }

    let totalChunksEmbedded = 0;
    let processedDocs = 0;

    for (const [docId, chunks] of docMap.entries()) {
      const texts = chunks.map(c => c.content);
      const vectors = await this.embeddingProvider.embedBatch(texts);
      const dimension = vectors[0]?.length || 0;
      const modelName = this.embeddingProvider.getModelName();

      const itemsToSave = chunks.map((chunk, index) => ({
        chunkId: chunk.id,
        embedding: vectors[index],
        model: modelName,
        dim: dimension,
      }));

      documentRepository.saveBatchEmbeddings(itemsToSave);
      documentRepository.updateEmbeddingStatus(docId, 'completed', modelName);

      totalChunksEmbedded += itemsToSave.length;
      processedDocs++;
    }

    return { processedDocs, totalChunksEmbedded };
  }

  /**
   * Performs semantic similarity retrieval over indexed document chunks in SQLite.
   */
  public async searchSimilar(options: SearchQueryOptions): Promise<SearchResponse> {
    const query = (options.query || '').trim();
    if (!query) {
      throw new Error('Search query must not be empty.');
    }

    const topK = Math.min(Math.max(1, options.topK ?? 5), 20);
    const minScore = options.minScore ?? 0.0;

    // 1. Generate query embedding with identical model
    const queryVector = await this.embeddingProvider.embed(query);
    const queryDim = queryVector.length;
    const modelName = this.embeddingProvider.getModelName();

    // 2. Fetch candidate chunks from SQLite (scoped to documentIds if provided)
    const candidates = documentRepository.getChunksWithEmbeddings(options.documentIds);

    if (candidates.length === 0) {
      return {
        query,
        model: modelName,
        dimension: queryDim,
        totalCandidates: 0,
        results: [],
      };
    }

    // 3. Compute cosine similarity with dimension validation
    const scoredItems: SearchResultItem[] = [];

    for (const candidate of candidates) {
      if (candidate.embedding_dim !== queryDim) {
        throw new DimensionMismatchError(queryDim, candidate.embedding_dim);
      }

      const score = cosineSimilarity(queryVector, candidate.embedding);

      if (score >= minScore) {
        scoredItems.push({
          chunkId: candidate.id,
          documentId: candidate.document_id,
          documentName: candidate.filename,
          pageNumber: candidate.page_number,
          chunkIndex: candidate.chunk_index,
          score: Number(score.toFixed(4)),
          content: candidate.content,
          charStart: candidate.char_start,
          charEnd: candidate.char_end,
          tokenCount: candidate.token_count,
        });
      }
    }

    // 4. Rank descending by similarity score
    scoredItems.sort((a, b) => b.score - a.score);

    // 5. Slice top K
    const topResults = scoredItems.slice(0, topK);

    return {
      query,
      model: modelName,
      dimension: queryDim,
      totalCandidates: candidates.length,
      results: topResults,
    };
  }
}

export const retrievalService = new RetrievalService();
