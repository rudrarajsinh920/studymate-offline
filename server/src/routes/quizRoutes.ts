import { Router } from 'express';
import { quizController } from '../controllers/quizController';

export const quizRouter = Router();

quizRouter.post('/quizzes/generate', quizController.generateQuiz);
quizRouter.get('/quizzes', quizController.listQuizzes);
quizRouter.get('/quizzes/:id', quizController.getQuiz);
quizRouter.delete('/quizzes/:id', quizController.deleteQuiz);

quizRouter.post('/quizzes/:id/attempt', quizController.submitAttempt);
quizRouter.get('/quizzes/:id/attempts', quizController.getAttempts);
