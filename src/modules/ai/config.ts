import 'server-only';
import type { AiProvider } from './provider';
import { createGeminiProvider } from './providers/gemini';
import { createMockProvider } from './providers/mock';

export type AiMode = 'gemini' | 'mock' | 'off';

/**
 * Which provider serves AI requests (docs/engineering/ai-architecture.md):
 * AI_PROVIDER=gemini|mock|off. Unset → gemini when a key exists, otherwise the mock in
 * development/test and off in production, so real users never see demo suggestions.
 */
export function aiMode(env: NodeJS.ProcessEnv = process.env): AiMode {
  const explicit = env.AI_PROVIDER?.trim().toLowerCase();
  if (Number(env.AI_DAILY_BUDGET ?? 1) === 0) return 'off';
  if (explicit === 'off') return 'off';
  if (explicit === 'mock') return 'mock';
  if (explicit === 'gemini') return env.GEMINI_API_KEY ? 'gemini' : 'off';
  if (env.GEMINI_API_KEY) return 'gemini';
  return env.NODE_ENV === 'production' ? 'off' : 'mock';
}

export function aiModels(env: NodeJS.ProcessEnv = process.env) {
  const fallback = 'gemini-flash-latest';
  return {
    fast: env.AI_MODEL_FAST?.trim() || fallback,
    smart: env.AI_MODEL_SMART?.trim() || env.AI_MODEL_FAST?.trim() || fallback,
  };
}

let cached: { mode: AiMode; provider: AiProvider | null } | null = null;

export function getAiProvider(): { mode: AiMode; provider: AiProvider | null } {
  const mode = aiMode();
  if (cached?.mode === mode) return cached;
  const provider =
    mode === 'gemini'
      ? createGeminiProvider({ apiKey: process.env.GEMINI_API_KEY! })
      : mode === 'mock'
        ? createMockProvider()
        : null;
  cached = { mode, provider };
  return cached;
}
