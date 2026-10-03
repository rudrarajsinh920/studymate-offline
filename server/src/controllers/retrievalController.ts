import { Request, Response } from 'express';
import { retrievalService } from '../services/rag/retrievalService';
import { EmbeddingServiceError } from '../services/ai/OllamaEmbeddingProvider';
import { DimensionMismatchError } from '../services/rag/vectorMath';

/**
 * Handle semantic retrieval query
 */
export async function searchSimilarChunks(req: Request, res: Response): Promise<void> {
  const { query, documentIds, topK, minScore } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'Search query must be a non-empty string.' });
    return;
  }

  if (documentIds && (!Array.isArray(documentIds) || documentIds.some(id => typeof id !== 'string'))) {
    res.status(400).json({ error: 'documentIds must be an array of document ID strings if provided.' });
    return;
  }

  try {
    const results = await retrievalService.searchSimilar({
      query: query.trim(),
      documentIds,
      topK: topK !== undefined ? parseInt(topK, 10) : 5,
      minScore: minScore !== undefined ? parseFloat(minScore) : 0.0,
    });

    res.json(results);
  } catch (err: unknown) {
    if (err instanceof EmbeddingServiceError) {
      res.status(503).json({
        error: err.message,
        code: err.code,
        instructions: err.instructions,
      });
      return;
    }

    if (err instanceof DimensionMismatchError) {
      res.status(409).json({
        error: err.message,
        hint: 'Embeddings were generated with a different model dimension. Re-embed documents using the current model.',
      });
      return;
    }

    const msg = err instanceof Error ? err.message : 'Semantic retrieval failed';
    res.status(500).json({ error: msg });
  }
}
