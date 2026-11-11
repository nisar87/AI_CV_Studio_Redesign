import 'server-only';
import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { currentUser, type SessionUser } from '@/modules/identity/session';

/**
 * Admin Console access (studio-master-plan §4.4): only sessions whose Firebase user has the
 * `admin` custom claim, checked on the server for every request. Every change is audited.
 */
export async function withAdmin(
  handler: (admin: SessionUser, rid: string) => Promise<Response>,
): Promise<Response> {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('UNAUTHORIZED', 'Please sign in.', rid);
  if (!user.admin) return apiError('FORBIDDEN', 'This area is for administrators only.', rid);
  try {
    return await handler(user, rid);
  } catch (e) {
    console.error(
      JSON.stringify({ level: 'error', area: 'admin', rid, message: (e as Error).message }),
    );
    return apiError('INTERNAL', 'Something went wrong. Please try again.', rid);
  }
}

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export const actor = (u: SessionUser) => u.email ?? u.uid;

export { diffSummary } from './diff';
