import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { ownShare, publicShare } from '@/modules/share/server';
import { getBusinessConfig } from '@/modules/billing/server';
import { getUserStore } from '@/modules/store';
import type { Share } from '@/modules/store/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string }> };

/**
 * PATCH { enabled?, comments?, notify? } → switch the link, comments on it, or comment emails on or
 * off. Comment emails go to the owner's sign-in address, kept when comments are turned on.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const share = await ownShare(user, (await ctx.params).token);
  if (!share) return apiError('NOT_FOUND', 'Link not found.', rid);
  const body = await readJson(req, 1024);
  const v = (body.ok ? body.value : {}) as Record<string, unknown>;
  const patch: Partial<Pick<Share, 'enabled' | 'comments' | 'notify' | 'ownerEmail'>> = {};
  for (const k of ['enabled', 'comments', 'notify'] as const)
    if (typeof v?.[k] === 'boolean') patch[k] = v[k] as boolean;
  if (!Object.keys(patch).length) return apiError('INVALID_INPUT', 'Nothing to change.', rid);
  if (patch.comments) {
    const cfg = (await getBusinessConfig()).value;
    if (!cfg.features.shareComments)
      return apiError('DISABLED', 'Comments on links are switched off at the moment.', rid);
  }
  if (patch.comments || patch.notify) patch.ownerEmail = user.email ?? null;
  await getUserStore().updateShare(share.token, patch);
  return NextResponse.json(
    { share: publicShare({ ...share, ...patch }) },
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
