import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { ownerComment } from '@/modules/share/comments';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** GET → every reviewer comment on this CV (open first, then newest), for its owner. */
export async function GET(_req: Request, ctx: Ctx) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { id } = await ctx.params;
  if (!/^[\w-]{1,64}$/.test(id)) return apiError('INVALID_INPUT', 'Invalid document.', rid);
  const store = getUserStore();
  const stored = await store.getDoc(user.uid, id);
  if (!stored || stored.deleted) return apiError('NOT_FOUND', 'This CV was not found.', rid);
  const comments = (await store.listComments(user.uid, id))
    .sort(
      (a, b) =>
        Number(a.status === 'done') - Number(b.status === 'done') ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .map((c) => ownerComment(c, stored.doc));
  return NextResponse.json({ comments }, { headers: { 'Cache-Control': 'no-store' } });
}
