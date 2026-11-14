import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { imageResponse } from '@/modules/portfolio/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const valid = (id: string) => /^[\w-]{1,40}$/.test(id);

/** GET → one of your own pictures (for the settings screen and your preview). */
export async function GET(_req: Request, ctx: Ctx) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { id } = await ctx.params;
  const img = valid(id) ? await getUserStore().getPortfolioImage(user.uid, id) : null;
  if (!img) return apiError('NOT_FOUND', 'Picture not found.', rid);
  return imageResponse(img, 'private, max-age=3600');
}

/** DELETE → removes one of your pictures. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { id } = await ctx.params;
  if (!valid(id)) return apiError('NOT_FOUND', 'Picture not found.', rid);
  await getUserStore().deletePortfolioImage(user.uid, id);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
