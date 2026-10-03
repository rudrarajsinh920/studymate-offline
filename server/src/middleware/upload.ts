import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// Ensure upload directory exists and is absolute
const uploadDirectory = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Allowed extensions and MIME types
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt']);
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'text/plain']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_req, file, cb) => {
    // Generate a secure, non-guessable random UUID filename to prevent path traversal and collisions
    const ext = path.extname(file.originalname).toLowerCase();
    const safeFilename = `${crypto.randomUUID()}${ext}`;
    cb(null, safeFilename);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new Error(`Unsupported file type '${ext}'. Only PDF (.pdf) and Text (.txt) files are accepted.`)
    );
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype) && file.mimetype !== 'application/octet-stream') {
    return cb(
      new Error(`Invalid MIME type '${file.mimetype}'. Expected application/pdf or text/plain.`)
    );
  }

  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
    files: 1,
  },
});

/**
 * Validates magic numbers of the file on disk to prevent disguised executables/scripts.
 */
export async function validateMagicBytes(filePath: string, ext: string): Promise<void> {
  const fd = await fs.promises.open(filePath, 'r');
  const buffer = Buffer.alloc(8);
  const { bytesRead } = await fd.read(buffer, 0, 8, 0);
  await fd.close();

  if (bytesRead === 0) {
    throw new Error('The uploaded file is empty (0 bytes).');
  }

  if (ext === '.pdf') {
    // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
    const header = buffer.toString('utf-8', 0, Math.min(5, bytesRead));
    if (!header.startsWith('%PDF-')) {
      throw new Error('Invalid PDF file format. The file header does not match standard PDF specifications.');
    }
  } else if (ext === '.txt') {
    // Ensure text file does not contain null bytes (binary files)
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0x00) {
        throw new Error('Binary content detected. Only valid UTF-8/plain text files are supported.');
      }
    }
  }
}

/**
 * Graceful multer error handler
 */
export function handleUploadErrors(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File exceeds maximum allowed size of ${config.maxFileSizeMb} MB.`,
      });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}
