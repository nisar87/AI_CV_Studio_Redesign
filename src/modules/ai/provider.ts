import type { TaskId } from './schemas';

export type JsonSchema = Record<string, unknown>;

export type GenerateRequest = {
  model: string;
  system: string;
  user: string;
  schema: JsonSchema;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
  /** Attached files (vision tasks): a PDF or page images, base64-encoded. */
  files?: AiFile[];
  /** Task id and parsed input — used only by the deterministic mock provider. */
  task: { id: TaskId; input: unknown };
};

export type AiFile = { mimeType: string; data: string };

export type GenerateResult = {
  /** Raw text returned by the model (expected to be JSON). */
  text: string;
  usage: { inputTokens: number; outputTokens: number };
};

export type ProviderErrorKind =
  'timeout' | 'rate_limited' | 'unavailable' | 'blocked' | 'bad_request' | 'auth';

export class AiProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
  get retryable() {
    return this.kind === 'rate_limited' || this.kind === 'unavailable';
  }
}

export interface AiProvider {
  id: 'gemini' | 'mock';
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
