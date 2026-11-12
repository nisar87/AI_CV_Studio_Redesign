import { isReferralCode, REF_COOKIE } from '@/modules/referrals/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * An invite link: remembers the code for 30 days, then opens the home page. The redirect is
 * relative: behind App Hosting's proxy, `req.url` carries the internal host, not aicvstudio.app.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = (await ctx.params).code.toUpperCase();
  const headers = new Headers({ Location: '/?invited=1', 'Cache-Control': 'no-store' });
  if (isReferralCode(code)) {
    const https =
      req.headers.get('x-forwarded-proto') === 'https' || new URL(req.url).protocol === 'https:';
    headers.append(
      'Set-Cookie',
      `${REF_COOKIE}=${code}; Path=/; Max-Age=${30 * 86_400}; HttpOnly; SameSite=Lax${https ? '; Secure' : ''}`,
    );
  }
  return new Response(null, { status: 303, headers });
}
