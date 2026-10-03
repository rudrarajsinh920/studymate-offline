import { Router } from 'express';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  embedSingleDocument,
  embedAllPendingDocuments,
} from '../controllers/documentController';
import { uploadMiddleware, handleUploadErrors } from '../middleware/upload';

export const documentRouter = Router();

documentRouter.post(
  '/documents/upload',
  uploadMiddleware.single('file'),
  handleUploadErrors,
  uploadDocument
);

documentRouter.get('/documents', listDocuments);
documentRouter.get('/documents/:id', getDocument);
documentRouter.delete('/documents/:id', deleteDocument);

// Milestone 3: Embedding management routes
documentRouter.post('/documents/:id/embed', embedSingleDocument);
documentRouter.post('/documents/embed-all', embedAllPendingDocuments);
