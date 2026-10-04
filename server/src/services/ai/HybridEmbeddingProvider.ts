import { config } from '../../config';
import { IEmbeddingProvider, EmbeddingAvailability } from './IEmbeddingProvider';
import { OllamaEmbeddingProvider } from './OllamaEmbeddingProvider';
import { GeminiEmbeddingProvider } from './GeminiEmbeddingProvider';

export class HybridEmbeddingProvider implements IEmbeddingProvider {
  private readonly ollamaProvider: OllamaEmbeddingProvider;
  private readonly geminiProvider: GeminiEmbeddingProvider;

  constructor(ollamaProvider?: OllamaEmbeddingProvider, geminiProvider?: GeminiEmbeddingProvider) {
    this.ollamaProvider = ollamaProvider || new OllamaEmbeddingProvider();
    this.geminiProvider = geminiProvider || new GeminiEmbeddingProvider();
  }

  public getModelName(): string {
    if (config.geminiApiKey) {
      return `${this.ollamaProvider.getModelName()} (with Gemini fallback)`;
    }
    return this.ollamaProvider.getModelName();
  }

  public async isAvailable(): Promise<EmbeddingAvailability> {
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

  public async embed(text: string): Promise<number[]> {
    try {
      return await this.ollamaProvider.embed(text);
    } catch (ollamaErr: unknown) {
      if (config.geminiApiKey && config.geminiApiKey.trim().length > 0) {
        console.log('[AI Fallback] Local embedding unavailable. Seamlessly using Gemini fallback...');
        return await this.geminiProvider.embed(text);
      }
      throw ollamaErr;
    }
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      return await this.ollamaProvider.embedBatch(texts);
    } catch (ollamaErr: unknown) {
      if (config.geminiApiKey && config.geminiApiKey.trim().length > 0) {
        console.log('[AI Fallback] Local embedding batch unavailable. Seamlessly using Gemini fallback...');
        return await this.geminiProvider.embedBatch(texts);
      }
      throw ollamaErr;
    }
  }
}
