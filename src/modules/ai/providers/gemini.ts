import 'server-only';
import { AiProviderError, type AiProvider, type GenerateRequest } from '../provider';

/**
 * Google Gemini adapter (ADR-0006). REST `models/{model}:generateContent` with JSON output
 * constrained by a JSON Schema. The key travels in a header, never in the URL.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { code?: number; message?: string; status?: string };
};

export function createGeminiProvider({
  apiKey,
  fetchImpl = fetch,
  baseUrl = BASE,
}: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): AiProvider {
  async function call(req: GenerateRequest, withSchema: boolean) {
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        ...(withSchema ? { responseJsonSchema: req.schema } : {}),
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens,
      },
    };
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/models/${encodeURIComponent(req.model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'TimeoutError' || name === 'AbortError')
        throw new AiProviderError('timeout', 'The AI service took too long to answer.');
      throw new AiProviderError('unavailable', 'Could not reach the AI service.');
    }
    const json = (await res.json().catch(() => ({}))) as GeminiResponse;
    return { res, json };
  }

  return {
    id: 'gemini',
    async generate(req) {
      let { res, json } = await call(req, true);
      // Older API versions or models may not accept `responseJsonSchema`; fall back to plain
      // JSON mode (the prompt describes the shape and Zod validates the result).
      if (
        res.status === 400 &&
        /response_?json_?schema|responseJsonSchema/i.test(json.error?.message ?? '')
      ) {
        ({ res, json } = await call(req, false));
      }
      if (!res.ok) {
        const msg = json.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 429) throw new AiProviderError('rate_limited', msg);
        if (res.status === 401 || res.status === 403) throw new AiProviderError('auth', msg);
        if (res.status === 400 || res.status === 404) throw new AiProviderError('bad_request', msg);
        throw new AiProviderError('unavailable', msg);
      }
      if (json.promptFeedback?.blockReason)
        throw new AiProviderError('blocked', `Blocked: ${json.promptFeedback.blockReason}`);
      const cand = json.candidates?.[0];
      if (cand?.finishReason && /SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(cand.finishReason))
        throw new AiProviderError('blocked', `Blocked: ${cand.finishReason}`);
      const text = (cand?.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
      return {
        text,
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    },
  };
}
