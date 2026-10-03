import { Request, Response } from 'express';
import { config } from '../config';

interface OllamaModelItem {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaTagsResponse {
  models?: OllamaModelItem[];
}

export const getHealth = async (_req: Request, res: Response) => {
  const startTime = Date.now();
  let ollamaStatus: {
    connected: boolean;
    baseUrl: string;
    configuredModels: {
      llm: string;
      embed: string;
    };
    detectedModels: string[];
    hasConfiguredLlm: boolean;
    hasConfiguredEmbed: boolean;
    message?: string;
    latencyMs?: number;
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const ollamaResponse = await fetch(`${config.ollama.baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (ollamaResponse.ok) {
      const data = (await ollamaResponse.json()) as OllamaTagsResponse;
      const detectedModels = (data.models || []).map((m) => m.name);
      const hasConfiguredLlm = detectedModels.some(
        (name) => name === config.ollama.llmModel || name.startsWith(config.ollama.llmModel.split(':')[0])
      );
      const hasConfiguredEmbed = detectedModels.some(
        (name) => name === config.ollama.embedModel || name.startsWith(config.ollama.embedModel.split(':')[0])
      );

      ollamaStatus = {
        connected: true,
        baseUrl: config.ollama.baseUrl,
        configuredModels: {
          llm: config.ollama.llmModel,
          embed: config.ollama.embedModel,
        },
        detectedModels,
        hasConfiguredLlm,
        hasConfiguredEmbed,
        latencyMs: Date.now() - startTime,
      };
    } else {
      ollamaStatus = {
        connected: false,
        baseUrl: config.ollama.baseUrl,
        configuredModels: {
          llm: config.ollama.llmModel,
          embed: config.ollama.embedModel,
        },
        detectedModels: [],
        hasConfiguredLlm: false,
        hasConfiguredEmbed: false,
        message: `Ollama returned HTTP status ${ollamaResponse.status}`,
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
    ollamaStatus = {
      connected: false,
      baseUrl: config.ollama.baseUrl,
      configuredModels: {
        llm: config.ollama.llmModel,
        embed: config.ollama.embedModel,
      },
      detectedModels: [],
      hasConfiguredLlm: false,
      hasConfiguredEmbed: false,
      message: `Cannot reach Ollama at ${config.ollama.baseUrl} (${errorMessage}). Ensure Ollama is installed and running locally.`,
    };
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    server: {
      port: config.port,
      nodeVersion: process.version,
    },
    ollama: ollamaStatus,
  });
};
