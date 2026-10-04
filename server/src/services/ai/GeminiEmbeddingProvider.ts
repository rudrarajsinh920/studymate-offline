import { config } from '../../config';
import { IEmbeddingProvider, EmbeddingAvailability } from './IEmbeddingProvider';
import { EmbeddingServiceError } from './OllamaEmbeddingProvider';

export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: string = 'text-embedding-004';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.geminiApiKey || '';
  }

  public getModelName(): string {
    return this.model;
  }

  public async isAvailable(): Promise<EmbeddingAvailability> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      return {
        available: false,
        modelInstalled: false,
        error: 'GEMINI_API_KEY is not configured.',
      };
    }
    return {
      available: true,
      modelInstalled: true,
    };
  }

  public async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new EmbeddingServiceError('GEMINI_API_KEY is not configured.', 'EMBED_FAILED');
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;
      const payload = {
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new EmbeddingServiceError(
          `Gemini Embedding API returned HTTP ${res.status}: ${errorText.slice(0, 200)}`,
          'EMBED_FAILED'
        );
      }

      const data = (await res.json()) as any;
      const values = data?.embedding?.values;

      if (!Array.isArray(values) || values.length === 0) {
        throw new EmbeddingServiceError('Gemini Embedding returned invalid vector array.', 'EMBED_FAILED');
      }

      return values;
    } catch (err: unknown) {
      if (err instanceof EmbeddingServiceError) throw err;
      const msg = err instanceof Error ? err.message : 'Unknown embedding error';
      throw new EmbeddingServiceError(`Gemini embedding failed: ${msg}`, 'EMBED_FAILED');
    }
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const vector = await this.embed(text);
      results.push(vector);
    }
    return results;
  }
}
