import { NextResponse } from 'next/server';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';
import { track } from '@/modules/metrics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Events only the browser sees (funnel steps). A fixed list; counts only, nothing personal. */
const ALLOWED = new Set(['landing_view', 'makeover_design_switch'] as const);
type Allowed = typeof ALLOWED extends Set<infer T> ? T : never;
const limiter = createRateLimiter({ capacity: 30, refillPerMinute: 30 });

export async function POST(req: Request) {
  const rid = requestId();
  if (!limiter(clientKey(req)).ok) return apiError('RATE_LIMITED', 'Slow down.', rid);
  const body = await readJson(req, 256);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const name = (body.value as { name?: unknown })?.name;
  if (typeof name !== 'string' || !ALLOWED.has(name as Allowed))
    return apiError('INVALID_INPUT', 'Unknown event.', rid);
  await track(name as Allowed);
  return new NextResponse(null, { status: 204 });
}
