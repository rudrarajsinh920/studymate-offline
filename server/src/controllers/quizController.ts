import { Request, Response } from 'express';
import { quizService, QuizGenerationError } from '../services/quiz/quizService';
import { LlmServiceError } from '../services/ai/OllamaLlmProvider';
import { EmbeddingServiceError } from '../services/ai/OllamaEmbeddingProvider';
import { GenerateQuizRequest, SubmitQuizAttemptRequest } from 'studymate-shared';

export const quizController = {
  async generateQuiz(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as GenerateQuizRequest;
      const quiz = await quizService.generateQuiz(body);
      res.status(201).json(quiz);
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

      if (err instanceof QuizGenerationError) {
        res.status(400).json({
          error: err.message,
          code: err.code,
          instructions: err.instructions,
        });
        return;
      }

      const message = err instanceof Error ? err.message : 'Failed to generate quiz';
      res.status(500).json({ error: message });
    }
  },

  listQuizzes(_req: Request, res: Response): void {
    try {
      const quizzes = quizService.listQuizzes();
      res.json(quizzes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list quizzes';
      res.status(500).json({ error: message });
    }
  },

  getQuiz(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const quiz = quizService.getQuiz(id);
      if (!quiz) {
        res.status(404).json({ error: `Quiz '${id}' was not found.` });
        return;
      }
      res.json(quiz);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get quiz';
      res.status(500).json({ error: message });
    }
  },

  deleteQuiz(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const deleted = quizService.deleteQuiz(id);
      if (!deleted) {
        res.status(404).json({ error: `Quiz '${id}' was not found.` });
        return;
      }
      res.json({ message: 'Quiz deleted successfully.', id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete quiz';
      res.status(500).json({ error: message });
    }
  },

  submitAttempt(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const body = req.body as SubmitQuizAttemptRequest;
      const result = quizService.submitAttempt(id, body);
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof QuizGenerationError) {
        res.status(404).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to submit quiz attempt';
      res.status(500).json({ error: message });
    }
  },

  getAttempts(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const attempts = quizService.getQuizAttempts(id);
      res.json(attempts);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get quiz attempts';
      res.status(500).json({ error: message });
    }
  },
};
