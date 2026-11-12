import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { planFor } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { publicPortfolio } from '@/modules/portfolio/server';
import { slugProblem } from '@/modules/portfolio/slug';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** GET → this account's portfolio settings (or null). */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const p = await getUserStore().getPortfolioOf(user.uid);
  return NextResponse.json({ portfolio: p ? publicPortfolio(p) : null }, noStore);
}

/** PUT { slug, docId, published, showEmail, showPhone } → saves (Premium only to publish). */
export async function PUT(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { plan } = await planFor(user);
  if (plan !== 'premium')
    return apiError('PREMIUM_REQUIRED', 'Your portfolio page is part of Premium.', rid, {
      reason: 'premium',
    });
  const body = await readJson(req, 4 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const b = body.value as Record<string, unknown>;
  const slug = String(b.slug ?? '')
    .trim()
    .toLowerCase();
  const problem = slugProblem(slug);
  if (problem) return apiError('INVALID_INPUT', problem, rid, { field: 'slug' });
  const docId = String(b.docId ?? '');
  const store = getUserStore();
  const stored = /^[\w-]{1,64}$/.test(docId) ? await store.getDoc(user.uid, docId) : null;
  if (!stored || stored.deleted)
    return apiError(
      'NOT_FOUND',
      'This CV is still saving to your account. Try again in a moment.',
      rid,
    );
  const now = new Date().toISOString();
  const cur = await store.getPortfolioOf(user.uid);
  const next = {
    slug,
    uid: user.uid,
    docId,
    published: b.published === true,
    showEmail: b.showEmail === true,
    showPhone: b.showPhone === true,
    createdAt: cur?.createdAt ?? now,
    updatedAt: now,
    views: cur?.slug === slug ? cur.views : 0,
  };
  if (!(await store.putPortfolio(next)))
    return apiError('CONFLICT', 'That address is taken. Please choose another.', rid, {
      field: 'slug',
    });
  return NextResponse.json({ portfolio: publicPortfolio(next) }, noStore);
}

/** DELETE → removes the page. */
export async function DELETE() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  await getUserStore().deletePortfolioOf(user.uid);
  return NextResponse.json({ ok: true }, noStore);
}
