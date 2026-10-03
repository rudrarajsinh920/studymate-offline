import { config } from '../../config';
import { IEmbeddingProvider, EmbeddingAvailability } from './IEmbeddingProvider';

export class EmbeddingServiceError extends Error {
  public readonly code: 'OLLAMA_UNREACHABLE' | 'MODEL_NOT_FOUND' | 'EMBED_FAILED';
  public readonly instructions?: string;

  constructor(
    message: string,
    code: 'OLLAMA_UNREACHABLE' | 'MODEL_NOT_FOUND' | 'EMBED_FAILED',
    instructions?: string
  ) {
    super(message);
    this.name = 'EmbeddingServiceError';
    this.code = code;
    this.instructions = instructions;
  }
}

export class OllamaEmbeddingProvider implements IEmbeddingProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || config.ollama.baseUrl;
    this.model = model || config.ollama.embedModel;
  }

  public getModelName(): string {
    return this.model;
  }

  /**
   * Probes Ollama connectivity and verifies that the configured embedding model is installed.
   */
  public async isAvailable(): Promise<EmbeddingAvailability> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          available: false,
          error: `Ollama service responded with HTTP ${res.status}`,
        };
      }

      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const modelList = (data.models || []).map((m) => m.name);
      const isInstalled = modelList.some(
        (name) => name === this.model || name.startsWith(this.model.split(':')[0])
      );

      if (!isInstalled) {
        return {
          available: false,
          modelInstalled: false,
          error: `Configured embedding model '${this.model}' is not installed in local Ollama. Run: 'ollama pull ${this.model}'`,
        };
      }

      return {
        available: true,
        modelInstalled: true,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return {
        available: false,
        error: `Cannot reach Ollama at ${this.baseUrl} (${msg}). Ensure Ollama is installed and running locally.`,
      };
    }
  }

  /**
   * Generates embedding vector for a single text string.
   */
  public async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    if (!results || results.length === 0) {
      throw new EmbeddingServiceError(
        'Failed to generate vector embedding from Ollama.',
        'EMBED_FAILED'
      );
    }
    return results[0];
  }

  /**
   * Generates embedding vectors for a batch of text strings using micro-batching.
   */
  public async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = [];
    const batchSize = 10;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await this.executeBatch(batch);
      allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
  }

  private async executeBatch(texts: string[]): Promise<number[][]> {
    // 1. First attempt: Modern Ollama /api/embed endpoint
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as { embeddings?: number[][] };
        if (data.embeddings && Array.isArray(data.embeddings)) {
          return data.embeddings;
        }
      } else if (res.status === 404) {
        // Model might not exist or endpoint is older Ollama
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        if (errJson.error && errJson.error.toLowerCase().includes('not found')) {
          throw new EmbeddingServiceError(
            `Embedding model '${this.model}' was not found in Ollama.`,
            'MODEL_NOT_FOUND',
            `Run: ollama pull ${this.model}`
          );
        }
      }
    } catch (err: unknown) {
      if (err instanceof EmbeddingServiceError) {
        throw err;
      }
      // If /api/embed failed, attempt legacy fallback below
    }

    // 2. Fallback attempt: Sequential /api/embeddings for older Ollama versions
    const fallbackResults: number[][] = [];
    for (const text of texts) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt: text,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          if (res.status === 404) {
            throw new EmbeddingServiceError(
              `Embedding model '${this.model}' not found in Ollama.`,
              'MODEL_NOT_FOUND',
              `Run: ollama pull ${this.model}`
            );
          }
          throw new EmbeddingServiceError(
            `Ollama embedding request failed with HTTP ${res.status}`,
            'EMBED_FAILED'
          );
        }

        const data = (await res.json()) as { embedding?: number[] };
        if (!data.embedding || !Array.isArray(data.embedding)) {
          throw new EmbeddingServiceError(
            'Invalid response format received from Ollama embedding endpoint.',
            'EMBED_FAILED'
          );
        }

        fallbackResults.push(data.embedding);
      } catch (err: unknown) {
        if (err instanceof EmbeddingServiceError) throw err;
        const msg = err instanceof Error ? err.message : 'Connection failed';
        throw new EmbeddingServiceError(
          `Unable to connect to Ollama at ${this.baseUrl} (${msg}).`,
          'OLLAMA_UNREACHABLE',
          'Make sure Ollama is installed and running locally.'
        );
      }
    }

    return fallbackResults;
  }
}
