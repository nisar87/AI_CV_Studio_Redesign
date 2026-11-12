import 'server-only';
import { getUserStore } from '@/modules/store';
import type { Portfolio } from '@/modules/store/types';
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

export const publicPortfolio = (p: Portfolio) => {
  const { uid: _uid, ...rest } = p;
  return rest;
};
export type PortfolioView = ReturnType<typeof publicPortfolio>;
