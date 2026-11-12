import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE → removes one of the account's saved designs. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return apiError('INVALID_INPUT', 'Invalid design.', rid);
  const ok = await getUserStore().deleteDesign(user.uid, id);
  if (!ok) return apiError('NOT_FOUND', 'That design was not found.', rid);
  return new NextResponse(null, { status: 204 });
}
