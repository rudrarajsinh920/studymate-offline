import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initDatabase } from './db/database';
import { healthRouter } from './routes/healthRoutes';
import { documentRouter } from './routes/documentRoutes';
import { retrievalRouter } from './routes/retrievalRoutes';
import { chatRouter } from './routes/chatRoutes';
import { plannerRouter } from './routes/plannerRoutes';
import { quizRouter } from './routes/quizRoutes';

const app = express();

// Initialize SQLite database schema and run non-destructive migrations
initDatabase();

// Middlewares
app.use(cors({
  origin: '*', // Local application allows local frontend access
}));
app.use(express.json());

// Routes
app.use('/api', healthRouter);
app.use('/api', documentRouter);
app.use('/api', retrievalRouter);
app.use('/api', chatRouter);
app.use('/api', plannerRouter);
app.use('/api', quizRouter);

// Root fallback / info
app.get('/', (_req, res) => {
  res.json({
    name: 'StudyMate Offline API',
    version: '0.1.0',
    description: 'Privacy-focused, locally runnable AI study companion for students',
    healthCheck: '/api/health',
    documentsApi: '/api/documents',
    retrievalApi: '/api/retrieval/search',
    chatApi: '/api/chat/ask',
    plannerApi: '/api/plans',
    quizApi: '/api/quizzes',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

const server = app.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(`  StudyMate Offline Server running`);
  console.log(`  Port:          ${config.port}`);
  console.log(`  Environment:   ${config.nodeEnv}`);
  console.log(`  Health API:    http://localhost:${config.port}/api/health`);
  console.log(`  Documents API: http://localhost:${config.port}/api/documents`);
  console.log(`  Retrieval API: http://localhost:${config.port}/api/retrieval/search`);
  console.log(`  Chat/Tutor API:http://localhost:${config.port}/api/chat/ask`);
  console.log(`===============================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
