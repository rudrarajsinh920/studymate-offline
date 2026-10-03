export interface LlmGenerateOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlmAvailability {
  available: boolean;
  error?: string;
  modelInstalled?: boolean;
}

export interface ILlmProvider {
  getModelName(): string;
  isAvailable(): Promise<LlmAvailability>;
  generate(prompt: string, options?: LlmGenerateOptions): Promise<string>;
}
