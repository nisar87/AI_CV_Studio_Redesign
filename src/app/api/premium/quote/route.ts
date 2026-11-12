import { NextResponse } from 'next/server';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';
import { getBusinessConfig } from '@/modules/billing/server';
import { quoteFor } from '@/modules/billing/quote';
import { currentUser } from '@/modules/identity/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Guessing codes is slow on purpose.
const limiter = createRateLimiter({ capacity: 10, refillPerMinute: 5 });

/** POST { passId, code? } → what this person would pay and get (coupon / welcome bonus applied). */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to get Premium.', rid);
  if (!limiter(`${user.uid}:${clientKey(req)}`).ok)
    return apiError('RATE_LIMITED', 'Too many tries. Please wait a minute.', rid);
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.sales) return apiError('DISABLED', 'Premium is not on sale yet.', rid);
  const raw = await readJson(req, 1024);
  if (!raw.ok) return apiError(raw.code, 'Invalid request.', rid);
  const b = raw.value as { passId?: unknown; code?: unknown };
  const r = await quoteFor(user, cfg, String(b.passId ?? ''), String(b.code ?? '').slice(0, 30));
  if (!r.ok) return apiError('INVALID_INPUT', r.message, rid, { field: 'code' });
  return NextResponse.json({ quote: r.quote }, { headers: { 'Cache-Control': 'no-store' } });
}
