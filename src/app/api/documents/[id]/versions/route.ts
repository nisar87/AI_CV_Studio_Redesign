import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Earlier versions kept when a newer save replaced them (last 10). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('UNAUTHORIZED', 'Please sign in.', rid);
  const { id } = await ctx.params;
  if (!/^[\w-]{1,64}$/.test(id)) return apiError('INVALID_INPUT', 'Invalid document.', rid);
  return NextResponse.json(
    { versions: await getUserStore().listVersions(user.uid, id) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
