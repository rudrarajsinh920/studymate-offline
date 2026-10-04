import { config } from '../../config';
import { ILlmProvider, LlmGenerateOptions, LlmAvailability } from './ILlmProvider';
import { LlmServiceError } from './OllamaLlmProvider';

export class GeminiLlmProvider implements ILlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey?: string, model: string = 'gemini-1.5-flash') {
    this.apiKey = apiKey || config.geminiApiKey || '';
    this.model = model;
  }

  public getModelName(): string {
    return this.model;
  }

  public async isAvailable(): Promise<LlmAvailability> {
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

  public async generate(prompt: string, options: LlmGenerateOptions = {}): Promise<string> {
    if (!this.apiKey) {
      throw new LlmServiceError('GEMINI_API_KEY is not configured.', 'GENERATION_FAILED');
    }

    const timeoutMs = options.timeoutMs ?? 30000;
    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens ?? 512;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const payload: any = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      };

      if (options.systemPrompt) {
        payload.systemInstruction = {
          parts: [{ text: options.systemPrompt }],
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text();
        throw new LlmServiceError(
          `Gemini API returned HTTP ${res.status}: ${errorBody.slice(0, 200)}`,
          'GENERATION_FAILED'
        );
      }

      const data = (await res.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text || typeof text !== 'string') {
        throw new LlmServiceError('Gemini API returned empty content.', 'GENERATION_FAILED');
      }

      return text.trim();
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof LlmServiceError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LlmServiceError(`Gemini request timed out after ${timeoutMs}ms`, 'TIMEOUT');
      }
      const msg = err instanceof Error ? err.message : 'Unknown Gemini error';
      throw new LlmServiceError(`Gemini generation failed: ${msg}`, 'GENERATION_FAILED');
    }
  }
}
