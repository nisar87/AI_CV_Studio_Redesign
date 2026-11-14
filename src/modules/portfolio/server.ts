import 'server-only';
import { getBusinessConfig } from '@/modules/billing/server';
import { mailSettings } from '@/modules/notify/server';
import { lastDays } from '@/modules/presence/daily';
import { getUserStore } from '@/modules/store';
import type { Portfolio, PortfolioImage } from '@/modules/store/types';
import { slugProblem } from './slug';

/** Whether the owner currently has Premium (portfolios are a Premium feature). */
async function ownerIsPremium(uid: string) {
  const pass = await getUserStore().getPass(uid);
  return !!pass && pass.expiresAt > new Date().toISOString();
}

/** The published page's CV, or null (unknown, unpublished, CV gone, or Premium ended). */
export async function resolvePortfolio(slug: string) {
  if (slugProblem(slug)) return null;
  const store = getUserStore();
  const p = await store.getPortfolio(slug);
  if (!p?.published) return null;
  const [stored, premium] = await Promise.all([
    store.getDoc(p.uid, p.docId),
    ownerIsPremium(p.uid),
  ]);
  if (!premium || !stored || stored.deleted || !stored.doc) return null;
  return { portfolio: p, doc: stored.doc };
}

export const publicPortfolio = (p: Portfolio) => ({
  slug: p.slug,
  docId: p.docId,
  published: p.published,
  showEmail: p.showEmail,
  showPhone: p.showPhone,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  views: p.views,
  recent: lastDays(p.daily),
  theme: p.theme ?? 'auto',
  sections: p.sections ?? [],
  projects: p.projects ?? [],
  contact: p.contact === true,
});
export type PortfolioView = ReturnType<typeof publicPortfolio>;

/**
 * Sends a stored picture. The type is the one sniffed at upload; nosniff and a closed CSP mean a
 * browser only ever treats it as a picture.
 */
export function imageResponse(img: PortfolioImage, cache: string) {
  return new Response(Buffer.from(img.data, 'base64'), {
    headers: {
      'Content-Type': img.type,
      'Content-Length': String(img.bytes),
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
    },
  });
}

/** Whether a page takes messages now: the owner turned it on, the switch is on and email works. */
export async function contactOpen(p: Portfolio) {
  if (!p.contact || !p.ownerEmail) return false;
  const cfg = (await getBusinessConfig()).value;
  return cfg.features.portfolioContact && mailSettings(cfg.support.email).configured;
}
