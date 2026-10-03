import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { tutorService } from '../services/rag/tutorService';
import { chatRepository } from '../db/repositories/chatRepository';
import { LlmServiceError } from '../services/ai/OllamaLlmProvider';
import { EmbeddingServiceError } from '../services/ai/OllamaEmbeddingProvider';
import { AskQuestionRequest, CreateSessionRequest } from 'studymate-shared';

export const chatController = {
  /**
   * Main grounded tutor question answering endpoint.
   * POST /api/chat/ask
   */
  async askQuestion(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as AskQuestionRequest;
      const question = (body.question || '').trim();

      if (!question) {
        res.status(400).json({
          error: 'Question is required and cannot be empty.',
        });
        return;
      }

      const result = await tutorService.answerQuestion({
        question,
        sessionId: body.sessionId,
        documentIds: body.documentIds,
        explanationMode: body.explanationMode,
        topK: body.topK,
      });

      res.json(result);
    } catch (err: unknown) {
      if (err instanceof LlmServiceError) {
        const statusCode = err.code === 'MODEL_NOT_FOUND' ? 404 : err.code === 'TIMEOUT' ? 504 : 503;
        res.status(statusCode).json({
          error: err.message,
          code: err.code,
          instructions: err.instructions,
        });
        return;
      }

      if (err instanceof EmbeddingServiceError) {
        res.status(503).json({
          error: err.message,
          code: err.code,
          instructions: err.instructions,
        });
        return;
      }

      const message = err instanceof Error ? err.message : 'Unknown generation failure';
      res.status(500).json({
        error: 'Failed to generate tutor response.',
        message,
      });
    }
  },

  /**
   * Create a new chat session.
   * POST /api/chat/sessions
   */
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as CreateSessionRequest;
      const sessionId = randomUUID();
      const title = (body.title || 'New Study Session').trim();

      const session = chatRepository.createSession(sessionId, title, body.documentFilterIds);
      res.status(201).json(session);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      res.status(500).json({ error: message });
    }
  },

  /**
   * List all chat sessions.
   * GET /api/chat/sessions
   */
  async listSessions(_req: Request, res: Response): Promise<void> {
    try {
      const sessions = chatRepository.listSessions();
      res.json(sessions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve sessions';
      res.status(500).json({ error: message });
    }
  },

  /**
   * Get session with full message history.
   * GET /api/chat/sessions/:id
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const session = chatRepository.getSessionWithMessages(id);

      if (!session) {
        res.status(404).json({ error: `Chat session '${id}' was not found.` });
        return;
      }

      res.json(session);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load session';
      res.status(500).json({ error: message });
    }
  },

  /**
   * Delete a chat session.
   * DELETE /api/chat/sessions/:id
   */
  async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = chatRepository.deleteSession(id);

      if (!deleted) {
        res.status(404).json({ error: `Chat session '${id}' was not found.` });
        return;
      }

      res.json({ message: 'Session deleted successfully.', id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      res.status(500).json({ error: message });
    }
  },

  /**
   * Clear messages in a session.
   * DELETE /api/chat/sessions/:id/messages
   */
  async clearSessionMessages(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const session = chatRepository.getSessionSummary(id);

      if (!session) {
        res.status(404).json({ error: `Chat session '${id}' was not found.` });
        return;
      }

      chatRepository.clearMessages(id);
      res.json({ message: 'Messages cleared successfully.', sessionId: id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear session messages';
      res.status(500).json({ error: message });
    }
  },
};
