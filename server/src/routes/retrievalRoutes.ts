import { Router } from 'express';
import { searchSimilarChunks } from '../controllers/retrievalController';

export const retrievalRouter = Router();

retrievalRouter.post('/retrieval/search', searchSimilarChunks);
