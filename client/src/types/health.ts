export interface OllamaHealth {
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
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  server: {
    port: number;
    nodeVersion: string;
  };
  ollama: OllamaHealth;
}
