import { config } from '../../config';
import { ILlmProvider, LlmGenerateOptions, LlmAvailability } from './ILlmProvider';
import { OllamaLlmProvider } from './OllamaLlmProvider';
import { GeminiLlmProvider } from './GeminiLlmProvider';

export class HybridLlmProvider implements ILlmProvider {
  private readonly ollamaProvider: OllamaLlmProvider;
  private readonly geminiProvider: GeminiLlmProvider;

  constructor(ollamaProvider?: OllamaLlmProvider, geminiProvider?: GeminiLlmProvider) {
    this.ollamaProvider = ollamaProvider || new OllamaLlmProvider();
    this.geminiProvider = geminiProvider || new GeminiLlmProvider();
  }

  public getModelName(): string {
    if (config.geminiApiKey) {
      return `${this.ollamaProvider.getModelName()} (with Gemini fallback)`;
    }
    return this.ollamaProvider.getModelName();
  }

  public async isAvailable(): Promise<LlmAvailability> {
    const ollamaAvail = await this.ollamaProvider.isAvailable();
    if (ollamaAvail.available) {
      return ollamaAvail;
    }

    if (config.geminiApiKey && config.geminiApiKey.trim().length > 0) {
      const geminiAvail = await this.geminiProvider.isAvailable();
      if (geminiAvail.available) {
        return {
          available: true,
          modelInstalled: true,
        };
      }
    }

    return ollamaAvail;
  }

  public async generate(prompt: string, options: LlmGenerateOptions = {}): Promise<string> {
    try {
      return await this.ollamaProvider.generate(prompt, options);
    } catch (ollamaErr: unknown) {
      if (config.geminiApiKey && config.geminiApiKey.trim().length > 0) {
        console.log('[AI Fallback] Local Ollama unavailable. Seamlessly using Gemini cloud fallback...');
        return await this.geminiProvider.generate(prompt, options);
      }
      throw ollamaErr;
    }
  }
}
