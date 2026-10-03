import path from 'path';
import dotenv from 'dotenv';

// Determine the server directory root (parent of dist/ or src/)
const serverRoot = path.resolve(__dirname, '..');

// Load environment variables from server/.env, then fallback to current working directory
dotenv.config({ path: path.join(serverRoot, '.env') });
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databasePath: string;
  uploadDir: string;
  maxFileSizeMb: number;
  ollama: {
    baseUrl: string;
    llmModel: string;
    embedModel: string;
    timeoutMs: number;
    maxTokens: number;
  };
}

const rawDbPath = process.env.DATABASE_PATH || './data/studymate.db';
const rawUploadDir = process.env.UPLOAD_DIR || './uploads';

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Always anchor relative paths to the serverRoot directory for stability across runners
  databasePath: path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(serverRoot, rawDbPath),
  uploadDir: path.isAbsolute(rawUploadDir) ? rawUploadDir : path.resolve(serverRoot, rawUploadDir),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10),
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    llmModel: process.env.OLLAMA_LLM_MODEL || 'llama3.2:3b',
    embedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
    timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '300000', 10),
    maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '512', 10),
  },
};
