import { config } from '../../config';
import { ILlmProvider, LlmGenerateOptions, LlmAvailability } from './ILlmProvider';

export class LlmServiceError extends Error {
  public readonly code: 'OLLAMA_UNREACHABLE' | 'MODEL_NOT_FOUND' | 'GENERATION_FAILED' | 'TIMEOUT';
  public readonly instructions?: string;

  constructor(
    message: string,
    code: 'OLLAMA_UNREACHABLE' | 'MODEL_NOT_FOUND' | 'GENERATION_FAILED' | 'TIMEOUT',
    instructions?: string
  ) {
    super(message);
    this.name = 'LlmServiceError';
    this.code = code;
    this.instructions = instructions;
  }
}

export class OllamaLlmProvider implements ILlmProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || config.ollama.baseUrl;
    this.model = model || config.ollama.llmModel;
  }

  public getModelName(): string {
    return this.model;
  }

  /**
   * Probes Ollama connectivity and verifies that the configured LLM model is installed.
   */
  public async isAvailable(): Promise<LlmAvailability> {
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
          error: `Configured language model '${this.model}' is not installed in local Ollama. Run: 'ollama pull ${this.model}'`,
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
   * Generates text response using local Ollama model.
   */
  public async generate(prompt: string, options: LlmGenerateOptions = {}): Promise<string> {
    const timeoutMs = options.timeoutMs ?? config.ollama.timeoutMs;
    const temperature = options.temperature !== undefined ? options.temperature : 0.1;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          system: options.systemPrompt,
          stream: false,
          options: {
            temperature,
            num_predict: options.maxTokens ?? config.ollama.maxTokens,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 404) {
          throw new LlmServiceError(
            `Language model '${this.model}' was not found in local Ollama.`,
            'MODEL_NOT_FOUND',
            `Run: ollama pull ${this.model}`
          );
        }
        throw new LlmServiceError(
          `Ollama generation failed with HTTP status ${res.status}`,
          'GENERATION_FAILED'
        );
      }

      const data = (await res.json()) as { response?: string };
      if (typeof data.response !== 'string') {
        throw new LlmServiceError(
          'Malformed response received from Ollama generation API.',
          'GENERATION_FAILED'
        );
      }

      return data.response.trim();
    } catch (err: unknown) {
      if (err instanceof LlmServiceError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LlmServiceError(
          `Ollama text generation timed out after ${timeoutMs / 1000} seconds. The local machine may be under heavy load.`,
          'TIMEOUT'
        );
      }
      const msg = err instanceof Error ? err.message : 'Network error';
      throw new LlmServiceError(
        `Unable to reach Ollama at ${this.baseUrl} (${msg}).`,
        'OLLAMA_UNREACHABLE',
        'Ensure Ollama is installed and running locally via `ollama serve`.'
      );
    }
  }
}
