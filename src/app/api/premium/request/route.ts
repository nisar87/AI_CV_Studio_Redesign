import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';
import { getBusinessConfig } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({
  passId: z.string().max(40),
  methodId: z.string().max(40),
  reference: z
    .string()
    .trim()
    .min(4, 'Please enter the transaction ID.')
    .max(60)
    .regex(/^[\w\- #/.:]+$/, 'Use only letters, numbers and - / . : #'),
  note: z.string().trim().max(300).optional(),
});

const limiter = createRateLimiter({ capacity: 5, refillPerMinute: 1 });

/** POST — "I have paid": records a request for an admin to check. One pending request at a time. */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to get Premium.', rid);
  if (!limiter(`${user.uid}:${clientKey(req)}`).ok)
    return apiError('RATE_LIMITED', 'Too many attempts. Please wait a minute.', rid);
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.sales)
    return apiError('DISABLED', 'Premium is not on sale yet. Please check back soon.', rid);
  const raw = await readJson(req, 4 * 1024);
  if (!raw.ok) return apiError(raw.code, 'Invalid request.', rid);
  const parsed = body.safeParse(raw.value);
  if (!parsed.success)
    return apiError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid request.', rid);
  const pass = cfg.passes.find((p) => p.id === parsed.data.passId && p.active);
  const method = cfg.payments.methods.find((m) => m.id === parsed.data.methodId && m.active);
  if (!pass || !method)
    return apiError('INVALID_INPUT', 'That option is no longer available. Please reload.', rid);
  const store = getUserStore();
  const pending = await store.listPaymentRequests({ uid: user.uid, status: 'pending', limit: 1 });
  if (pending.length)
    return apiError(
      'INVALID_INPUT',
      'We are still checking your last payment. You will get Premium as soon as it is approved.',
      rid,
    );
  const saved = await store.createPaymentRequest({
    uid: user.uid,
    email: user.email,
    passId: pass.id,
    passLabel: pass.label,
    days: pass.days,
    pricePkr: pass.pricePkr,
    methodId: method.id,
    methodLabel: method.label,
    reference: parsed.data.reference,
    ...(parsed.data.note ? { note: parsed.data.note } : {}),
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(
    { ok: true, id: saved.id },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
