import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { syncQueue } from '@/modules/jobs/reminders-server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** GET → { emails: boolean } (are reminder emails on for me?). */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const q = await getUserStore().getReminderQueue(user.uid);
  return NextResponse.json({ emails: !(q?.off ?? false), email: user.email }, noStore);
}

/** PUT { emails: boolean } → { emails }. */
export async function PUT(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const body = await readJson(req, 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const p = z.object({ emails: z.boolean() }).safeParse(body.value);
  if (!p.success) return apiError('INVALID_INPUT', 'Invalid setting.', rid);
  const q = await syncQueue(user, { off: !p.data.emails });
  return NextResponse.json({ emails: !q.off }, noStore);
}
