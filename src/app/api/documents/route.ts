import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET → summaries of the user's documents (including recent deletions, for sync). */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('UNAUTHORIZED', 'Please sign in.', rid);
  const documents = await getUserStore().listDocs(user.uid);
  return NextResponse.json({ documents }, { headers: { 'Cache-Control': 'no-store' } });
}
