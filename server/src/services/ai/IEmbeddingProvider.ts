export interface EmbeddingAvailability {
  available: boolean;
  error?: string;
  modelInstalled?: boolean;
}

export interface IEmbeddingProvider {
  getModelName(): string;
  isAvailable(): Promise<EmbeddingAvailability>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
