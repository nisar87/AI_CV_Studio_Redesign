import 'server-only';
import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LIMIT_REACHED'
  | 'SIGN_IN_REQUIRED'
  | 'PREMIUM_REQUIRED'
  | 'DISABLED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_OUTPUT'
  | 'RENDER_FAILED'
  | 'UNPROCESSABLE'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LIMIT_REACHED: 402,
  SIGN_IN_REQUIRED: 401,
  PREMIUM_REQUIRED: 402,
  DISABLED: 403,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  AI_INVALID_OUTPUT: 502,
  RENDER_FAILED: 500,
  UNPROCESSABLE: 422,
  INTERNAL: 500,
};

export function requestId(): string {
  return crypto.randomUUID();
}

/** Error envelope from docs/engineering/api-contracts.md. */
export function apiError(
  code: ErrorCode,
  message: string,
  rid: string,
  details?: unknown,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status: STATUS[code], headers: { 'x-request-id': rid, ...headers } },
  );
}

/** Read a JSON body with a hard size limit. */
export async function readJson(
  req: Request,
  maxBytes: number,
): Promise<
  { ok: true; value: unknown } | { ok: false; code: 'PAYLOAD_TOO_LARGE' | 'INVALID_INPUT' }
> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, code: 'INVALID_INPUT' };
  }
}

/** Read a binary body, stopping as soon as it passes the limit (a missing length is not trusted). */
export async function readBytes(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; code: 'PAYLOAD_TOO_LARGE' }> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
  if (!req.body) return { ok: true, bytes: new Uint8Array() };
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.byteLength;
  }
  return { ok: true, bytes };
}

/** Simple per-key token bucket (per server instance). Replace with a shared store when scaling out. */
export function createRateLimiter({
  capacity,
  refillPerMinute,
}: {
  capacity: number;
  refillPerMinute: number;
}) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return function take(key: string): { ok: boolean; retryAfterSec: number } {
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: capacity, at: now };
    b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 60_000) * refillPerMinute);
    b.at = now;
    if (buckets.size > 10_000) buckets.clear();
    if (b.tokens < 1) {
      buckets.set(key, b);
      return { ok: false, retryAfterSec: Math.ceil(((1 - b.tokens) / refillPerMinute) * 60) };
    }
    b.tokens -= 1;
    buckets.set(key, b);
    return { ok: true, retryAfterSec: 0 };
  };
}

export function clientKey(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  );
}
