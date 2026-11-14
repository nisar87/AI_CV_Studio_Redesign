import { NextResponse } from 'next/server';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';
import { getBusinessConfig } from '@/modules/billing/server';
import { track } from '@/modules/metrics/server';
import { contactEmail, sendMail } from '@/modules/notify/server';
import { contactOpen, resolvePortfolio } from '@/modules/portfolio/server';
import { contactInput } from '@/modules/portfolio/themes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ slug: string }> };
const noStore = { 'Cache-Control': 'no-store' };

// Visitors don't sign in: messages are limited per network address and per page.
const g = globalThis as {
  __contactIp?: ReturnType<typeof createRateLimiter>;
  __contactPage?: ReturnType<typeof createRateLimiter>;
};
const perIp = (g.__contactIp ??= createRateLimiter({ capacity: 3, refillPerMinute: 0.3 }));
const perPage = (g.__contactPage ??= createRateLimiter({ capacity: 20, refillPerMinute: 1 / 72 }));

/** POST { name, email, message } → emails the page's owner (reply goes to the visitor). */
export async function POST(req: Request, ctx: Ctx) {
  const rid = requestId();
  const { slug } = await ctx.params;
  const r = await resolvePortfolio(slug);
  const owner = r?.portfolio.ownerEmail;
  if (!r || !owner || !(await contactOpen(r.portfolio)))
    return apiError('NOT_FOUND', 'This page doesn’t take messages.', rid, undefined, noStore);
  const body = await readJson(req, 8 * 1024);
  if (!body.ok)
    return apiError(
      body.code,
      body.code === 'PAYLOAD_TOO_LARGE' ? 'This message is too long.' : 'Invalid request.',
      rid,
    );
  const parsed = contactInput.safeParse(body.value);
  if (!parsed.success)
    return apiError(
      'INVALID_INPUT',
      parsed.error.issues[0]?.message ?? 'Check your message and try again.',
      rid,
    );
  // A form-filling robot: look successful, send nothing.
  if (parsed.data.website)
    return NextResponse.json({ ok: true }, { status: 201, headers: noStore });
  const ip = perIp(clientKey(req));
  const page = ip.ok ? perPage(slug) : ip;
  if (!ip.ok || !page.ok)
    return apiError(
      'RATE_LIMITED',
      'Too many messages for now. Please try again later.',
      rid,
      undefined,
      { 'Retry-After': String(Math.max(ip.retryAfterSec, page.retryAfterSec)) },
    );
  const cfg = (await getBusinessConfig()).value;
  const sent = await sendMail(
    contactEmail(owner, { ...parsed.data, slug: r.portfolio.slug }),
    cfg.support.email,
  );
  await track(sent.ok ? 'portfolio_contact' : 'portfolio_contact_fail');
  if (!sent.ok)
    return apiError('INTERNAL', 'Your message couldn’t be sent. Please try again later.', rid);
  return NextResponse.json({ ok: true }, { status: 201, headers: noStore });
}
