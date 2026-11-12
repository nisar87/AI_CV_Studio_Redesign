import { NextResponse } from 'next/server';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';
import {
  AuthError,
  clearSessionCookie,
  createSessionCookie,
  currentUser,
  revokeSessions,
  setSessionCookie,
} from '@/modules/identity/session';
import { getBusinessConfig } from '@/modules/billing/server';
import { getUserStore } from '@/modules/store';
import { track } from '@/modules/metrics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sign-ins per minute per IP (burst = 2x). Configurable for load tests and e2e.
const PER_MINUTE = Number(process.env.RATE_LIMIT_SESSION_PER_MINUTE ?? 10);
const limiter = createRateLimiter({ capacity: PER_MINUTE * 2, refillPerMinute: PER_MINUTE });

/** POST { idToken } → sets the session cookie. */
export async function POST(req: Request) {
  const rid = requestId();
  if (!limiter(clientKey(req)).ok)
    return apiError('RATE_LIMITED', 'Too many sign-in attempts. Please wait a minute.', rid);
  const body = await readJson(req, 8 * 1024);
  const idToken = body.ok ? (body.value as { idToken?: unknown })?.idToken : undefined;
  if (typeof idToken !== 'string' || idToken.length > 4096)
    return apiError('INVALID_INPUT', 'Invalid request.', rid);
  try {
    const session = await createSessionCookie(idToken);
    // New accounts can be paused from the Admin Console; existing accounts still sign in.
    if (!session.admin && !(await getBusinessConfig()).value.features.signups) {
      if (!(await getUserStore().knownUser(session.uid)))
        return apiError(
          'DISABLED',
          'New accounts are paused right now. Please try again later.',
          rid,
        );
    }
    await setSessionCookie(session.value, session.maxAge);
    const known = await getUserStore()
      .knownUser(session.uid)
      .catch(() => true);
    await track(known ? 'signin' : 'account_new');
    await getUserStore()
      .touchUser(session.uid, { email: session.email, name: session.name })
      .catch((e: Error) =>
        console.error(
          JSON.stringify({ level: 'error', route: '/api/session', rid, message: e.message }),
        ),
      );
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof AuthError) return apiError('UNAUTHORIZED', err.message, rid);
    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/session',
        rid,
        message: (err as Error).message,
      }),
    );
    return apiError('INTERNAL', 'We couldn’t sign you in just now. Please try again.', rid);
  }
}

/** DELETE → signs out (this device; ?everywhere=1 revokes all sessions). */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (user && new URL(req.url).searchParams.get('everywhere') === '1')
    await revokeSessions(user.uid).catch(() => {});
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
