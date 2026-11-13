import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SessionUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';
import { lastDays } from '@/modules/presence/daily';
import type { Share } from '@/modules/store/types';

/** Unguessable link token (128 bits, URL-safe). */
export const newShareToken = () => randomBytes(16).toString('base64url');
export const isShareToken = (t: string) => /^[A-Za-z0-9_-]{20,32}$/.test(t);

/** The CV behind an enabled link, or null (unknown, switched off, or the CV was deleted). */
export async function resolveShare(token: string) {
  if (!isShareToken(token)) return null;
  const store = getUserStore();
  const share = await store.getShare(token);
  if (!share?.enabled) return null;
  const stored = await store.getDoc(share.uid, share.docId);
  if (!stored || stored.deleted || !stored.doc) return null;
  return { share, doc: stored.doc };
}

/** What the owner sees: no uid. */
export const publicShare = (s: Share) => ({
  token: s.token,
  docId: s.docId,
  enabled: s.enabled,
  createdAt: s.createdAt,
  views: s.views,
  lastViewedAt: s.lastViewedAt,
  recent: lastDays(s.daily),
});
export type ShareView = ReturnType<typeof publicShare>;

export async function ownShare(user: SessionUser, token: string) {
  if (!isShareToken(token)) return null;
  const s = await getUserStore().getShare(token);
  return s && s.uid === user.uid ? s : null;
}
