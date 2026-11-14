import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { ownerComment } from '@/modules/share/comments';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string; cid: string }> };
const valid = (s: string) => /^[\w-]{1,64}$/.test(s);

type Loaded =
  | { error: 'SIGN_IN_REQUIRED' | 'NOT_FOUND' }
  | {
      error?: undefined;
      user: NonNullable<Awaited<ReturnType<typeof currentUser>>>;
      store: ReturnType<typeof getUserStore>;
      c: NonNullable<Awaited<ReturnType<ReturnType<typeof getUserStore>['getComment']>>>;
      id: string;
    };

async function load(ctx: Ctx): Promise<Loaded> {
  const user = await currentUser();
  if (!user) return { error: 'SIGN_IN_REQUIRED' as const };
  const { id, cid } = await ctx.params;
  if (!valid(id) || !valid(cid)) return { error: 'NOT_FOUND' as const };
  const store = getUserStore();
  const c = await store.getComment(user.uid, id, cid);
  if (!c) return { error: 'NOT_FOUND' as const };
  return { user, store, c, id };
}

/** PATCH { status: 'open' | 'done' } → mark a comment as dealt with (or not). */
export async function PATCH(req: Request, ctx: Ctx) {
  const rid = requestId();
  const r = await load(ctx);
  if (r.error)
    return apiError(
      r.error,
      r.error === 'NOT_FOUND' ? 'Comment not found.' : 'Please sign in.',
      rid,
    );
  const body = await readJson(req, 512);
  const status = body.ok ? (body.value as { status?: unknown })?.status : undefined;
  if (status !== 'open' && status !== 'done')
    return apiError('INVALID_INPUT', 'Choose open or done.', rid);
  const next = { ...r.c, status } as typeof r.c;
  await r.store.putComment(r.user.uid, next);
  const stored = await r.store.getDoc(r.user.uid, r.id);
  return NextResponse.json(
    { comment: ownerComment(next, stored?.doc ?? null) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** DELETE → removes the comment for good. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const rid = requestId();
  const r = await load(ctx);
  if (r.error)
    return apiError(
      r.error,
      r.error === 'NOT_FOUND' ? 'Comment not found.' : 'Please sign in.',
      rid,
    );
  await r.store.deleteComment(r.user.uid, r.id, r.c.id);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
