import { NextResponse } from 'next/server';
import { isReferralCode, REF_COOKIE } from '@/modules/referrals/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** An invite link: remembers the code for 30 days, then opens the home page. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = (await ctx.params).code.toUpperCase();
  const res = NextResponse.redirect(new URL('/?invited=1', req.url), 303);
  if (isReferralCode(code))
    res.cookies.set(REF_COOKIE, code, {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(req.url).protocol === 'https:',
      path: '/',
      maxAge: 30 * 86_400,
    });
  return res;
}
