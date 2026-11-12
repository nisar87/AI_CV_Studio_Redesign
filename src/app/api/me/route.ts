import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { apiError, readJson, requestId } from '@/lib/http';
import { clearSessionCookie, currentUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The signed-in user (or null). Plan and usage are added in R1.2. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    {
      user: user
        ? {
            uid: user.uid,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            picture: user.picture,
            admin: user.admin,
          }
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * DELETE { confirm: "DELETE" } — deletes the account and everything stored for it (CVs, versions,
 * pass, usage). Payment records are kept for accounting with the email removed.
 */
export async function DELETE(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('UNAUTHORIZED', 'Please sign in.', rid);
  const body = await readJson(req, 1024);
  if (!body.ok || (body.value as { confirm?: unknown }).confirm !== 'DELETE')
    return apiError('INVALID_INPUT', 'Type DELETE to confirm.', rid);
  if (user.admin)
    return apiError(
      'FORBIDDEN',
      'Administrator accounts can’t be deleted here. Remove the admin role first.',
      rid,
    );
  try {
    await getUserStore().deleteUserData(user.uid);
    await adminAuth().deleteUser(user.uid);
  } catch (e) {
    console.error(
      JSON.stringify({
        level: 'error',
        route: 'DELETE /api/me',
        rid,
        message: (e as Error).message,
      }),
    );
    return apiError('INTERNAL', 'We couldn’t delete your account just now. Please try again.', rid);
  }
  await clearSessionCookie();
  console.log(
    JSON.stringify({ level: 'info', route: 'DELETE /api/me', rid, event: 'account_deleted' }),
  );
  return NextResponse.json({ ok: true });
}
