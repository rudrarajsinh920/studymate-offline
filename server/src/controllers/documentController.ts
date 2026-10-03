import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config';
import { documentRepository } from '../db/repositories/documentRepository';
import { parseDocumentFile, DocumentParseError } from '../services/parser/documentParser';
import { chunkDocument } from '../services/parser/textChunker';
import { validateMagicBytes } from '../middleware/upload';
import { retrievalService } from '../services/rag/retrievalService';
import { EmbeddingServiceError } from '../services/ai/OllamaEmbeddingProvider';

/**
 * Handle document upload, validation, parsing, and chunking
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'No file uploaded. Please select a valid .pdf or .txt file.' });
    return;
  }

  const filePath = file.path;
  const ext = path.extname(file.originalname).toLowerCase();
  const fileType = ext === '.pdf' ? 'pdf' : 'txt';
  const documentId = crypto.randomUUID();

  // Sanitize original filename for display (strip path chars, control chars)
  const cleanOriginalName = path.basename(file.originalname).replace(/[\r\n\0]/g, '');

  try {
    // 1. Validate magic bytes and format integrity
    await validateMagicBytes(filePath, ext);

    // 2. Register document in SQLite with 'processing' status
    documentRepository.create({
      id: documentId,
      filename: cleanOriginalName,
      stored_filename: file.filename,
      file_type: fileType,
      file_size: file.size,
      status: 'processing',
    });

    // 3. Extract text & pages
    const parsedDoc = await parseDocumentFile(filePath, fileType);

    // 4. Chunk text with true character offsets and page tracking
    const chunks = chunkDocument(documentId, parsedDoc, {
      chunkSize: 600,
      chunkOverlap: 100,
    });

    if (chunks.length === 0) {
      throw new DocumentParseError('The document contains no chunkable text content.');
    }

    // 5. Store chunks in SQLite
    documentRepository.insertChunks(chunks);

    // 6. Update document status to ready
    documentRepository.updateStatus(documentId, 'ready', {
      chunkCount: chunks.length,
      characterCount: parsedDoc.totalCharacters,
    });

    // 7. Attempt embedding generation (gracefully skip if Ollama is not active)
    let embeddingGenerated = false;
    try {
      const availability = await retrievalService.getEmbeddingProvider().isAvailable();
      if (availability.available) {
        await retrievalService.embedDocumentChunks(documentId);
        embeddingGenerated = true;
      }
    } catch (embedErr) {
      console.warn(`[Embedding Notice]: Deferred embedding for document ${documentId}:`, embedErr);
    }

    const summary = documentRepository.getById(documentId);
    if (!summary) {
      res.status(500).json({ error: 'Failed to retrieve saved document metadata.' });
      return;
    }

    const { stored_filename, ...clientSafeSummary } = summary;
    res.status(201).json({
      message: 'Document uploaded and chunked successfully',
      document: clientSafeSummary,
      embeddingGenerated,
    });
  } catch (error: unknown) {
    // Clean up file from disk upon failure
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore deletion errors on cleanup
      }
    }

    // If document record was already created, delete it
    documentRepository.delete(documentId);

    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    res.status(400).json({
      error: errorMessage,
    });
  }
}

/**
 * Trigger embedding generation for a specific document
 */
export async function embedSingleDocument(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const doc = documentRepository.getById(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const result = await retrievalService.embedDocumentChunks(id);
    res.json({
      success: true,
      message: `Successfully generated embeddings for ${result.embeddedCount} chunks.`,
      ...result,
    });
  } catch (err: unknown) {
    if (err instanceof EmbeddingServiceError) {
      res.status(503).json({
        error: err.message,
        code: err.code,
        instructions: err.instructions,
      });
      return;
    }
    const msg = err instanceof Error ? err.message : 'Embedding generation failed';
    res.status(500).json({ error: msg });
  }
}

/**
 * Trigger backfill embedding generation for all pending chunks
 */
export async function embedAllPendingDocuments(_req: Request, res: Response): Promise<void> {
  try {
    const result = await retrievalService.backfillPendingEmbeddings();
    res.json({
      success: true,
      message: `Processed ${result.processedDocs} documents, generated embeddings for ${result.totalChunksEmbedded} chunks.`,
      ...result,
    });
  } catch (err: unknown) {
    if (err instanceof EmbeddingServiceError) {
      res.status(503).json({
        error: err.message,
        code: err.code,
        instructions: err.instructions,
      });
      return;
    }
    const msg = err instanceof Error ? err.message : 'Failed to backfill embeddings';
    res.status(500).json({ error: msg });
  }
}

/**
 * List all documents (safe metadata only, no local filesystem paths)
 */
export function listDocuments(_req: Request, res: Response): void {
  try {
    const documents = documentRepository.listSummaries();
    res.json({ documents });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to query documents';
    res.status(500).json({ error: msg });
  }
}

/**
 * Get document details and all associated chunks
 */
export function getDocument(req: Request, res: Response): void {
  const { id } = req.params;

  try {
    const data = documentRepository.getSummaryWithChunks(id);
    if (!data) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve document';
    res.status(500).json({ error: msg });
  }
}

/**
 * Delete document, its database records, its chunks, and its local disk file
 */
export function deleteDocument(req: Request, res: Response): void {
  const { id } = req.params;

  try {
    const existing = documentRepository.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // 1. Remove from database (cascades to chunks)
    documentRepository.delete(id);

    // 2. Securely remove stored file from disk
    const uploadRoot = path.resolve(config.uploadDir);
    const targetFilePath = path.resolve(uploadRoot, existing.stored_filename);

    // Path traversal check
    if (targetFilePath.startsWith(uploadRoot)) {
      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
      }
    }

    res.json({
      success: true,
      message: `Document '${existing.filename}' and all associated chunks deleted successfully.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete document';
    res.status(500).json({ error: msg });
  }
}
