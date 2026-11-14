import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { getBusinessConfig, planFor } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { publicPortfolio } from '@/modules/portfolio/server';
import { slugProblem } from '@/modules/portfolio/slug';
import { extrasInput, usedImages } from '@/modules/portfolio/themes';
import { getUserStore } from '@/modules/store';
import type { Portfolio } from '@/modules/store/types';

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

/**
 * PUT { slug, docId, published, showEmail, showPhone, theme, sections, projects, contact } →
 * saves (Premium). Contact messages go to the owner's sign-in address, kept when they save.
 */
export async function PUT(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { plan } = await planFor(user);
  if (plan !== 'premium')
    return apiError('PREMIUM_REQUIRED', 'Your portfolio page is part of Premium.', rid, {
      reason: 'premium',
    });
  const body = await readJson(req, 64 * 1024);
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
  const extras = extrasInput.safeParse({
    theme: b.theme,
    sections: b.sections,
    projects: b.projects,
    contact: b.contact === true,
  });
  if (!extras.success)
    return apiError(
      'INVALID_INPUT',
      extras.error.issues[0]?.message ?? 'Check the page’s sections and projects.',
      rid,
    );
  const x = extras.data;
  // Every picture must be one this account uploaded.
  const images = await store.listPortfolioImages(user.uid);
  const mine = new Set(images.map((i) => i.id));
  const used = usedImages(x.projects);
  if ([...used].some((id) => !mine.has(id)))
    return apiError('INVALID_INPUT', 'A picture is missing. Please add it again.', rid);
  if (x.contact) {
    const cfg = (await getBusinessConfig()).value;
    if (!cfg.features.portfolioContact)
      return apiError('DISABLED', 'Contact forms are switched off at the moment.', rid);
  }
  const now = new Date().toISOString();
  const cur = await store.getPortfolioOf(user.uid);
  const next: Portfolio = {
    slug,
    uid: user.uid,
    docId,
    published: b.published === true,
    showEmail: b.showEmail === true,
    showPhone: b.showPhone === true,
    createdAt: cur?.createdAt ?? now,
    updatedAt: now,
    views: cur?.slug === slug ? cur.views : 0,
    ...(cur?.slug === slug && cur.daily ? { daily: cur.daily } : {}),
    theme: x.theme,
    sections: x.sections,
    projects: x.projects,
    contact: x.contact,
    ownerEmail: x.contact ? (user.email ?? null) : null,
  };
  if (!(await store.putPortfolio(next)))
    return apiError('CONFLICT', 'That address is taken. Please choose another.', rid, {
      field: 'slug',
    });
  // Pictures no longer on the page are removed, except fresh uploads not saved yet.
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  await Promise.all(
    images
      .filter((i) => !used.has(i.id) && i.createdAt < dayAgo)
      .map((i) => store.deletePortfolioImage(user.uid, i.id)),
  );
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
