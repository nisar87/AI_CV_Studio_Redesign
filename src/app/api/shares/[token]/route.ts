import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { ownShare, publicShare } from '@/modules/share/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string }> };

/** PATCH { enabled } → switch a link off or back on. */
export async function PATCH(req: Request, ctx: Ctx) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const share = await ownShare(user, (await ctx.params).token);
  if (!share) return apiError('NOT_FOUND', 'Link not found.', rid);
  const body = await readJson(req, 1024);
  const enabled = body.ok && (body.value as { enabled?: unknown })?.enabled === true;
  await getUserStore().updateShare(share.token, { enabled });
  return NextResponse.json(
    { share: publicShare({ ...share, enabled }) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** DELETE → removes the link for good (a new one gets a new address). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const share = await ownShare(user, (await ctx.params).token);
  if (!share) return apiError('NOT_FOUND', 'Link not found.', rid);
  await getUserStore().deleteShare(share.token);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
