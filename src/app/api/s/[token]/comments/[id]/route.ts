import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { reviewerKey } from '@/modules/share/comments';
import { commentableShare, hashKey } from '@/modules/share/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string; id: string }> };

/** DELETE (header x-reviewer-key) → a reviewer takes back their own comment. */
export async function DELETE(req: Request, ctx: Ctx) {
  const rid = requestId();
  const { token, id } = await ctx.params;
  const r = await commentableShare(token);
  if (!r) return apiError('NOT_FOUND', 'Comments aren’t open on this link.', rid);
  const key = reviewerKey.safeParse(req.headers.get('x-reviewer-key') ?? '');
  if (!key.success || !/^[\w-]{1,64}$/.test(id))
    return apiError('NOT_FOUND', 'Comment not found.', rid);
  const store = getUserStore();
  const c = await store.getComment(r.share.uid, r.share.docId, id);
  if (!c || c.token !== token || c.keyHash !== hashKey(key.data))
    return apiError('NOT_FOUND', 'Comment not found.', rid);
  await store.deleteComment(r.share.uid, r.share.docId, id);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
