import { Router } from 'express';
import { chatController } from '../controllers/chatController';

export const chatRouter = Router();

// Ask tutor a grounded question
chatRouter.post('/chat/ask', chatController.askQuestion);

// Manage chat sessions
chatRouter.post('/chat/sessions', chatController.createSession);
chatRouter.get('/chat/sessions', chatController.listSessions);
chatRouter.get('/chat/sessions/:id', chatController.getSession);
chatRouter.delete('/chat/sessions/:id', chatController.deleteSession);
chatRouter.delete('/chat/sessions/:id/messages', chatController.clearSessionMessages);
