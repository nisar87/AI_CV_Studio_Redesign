import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { SessionUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';
import { lastDays } from '@/modules/presence/daily';
import type { Share } from '@/modules/store/types';
import { getBusinessConfig } from '@/modules/billing/server';
import { track } from '@/modules/metrics/server';
import { commentEmail, sendMail } from '@/modules/notify/server';

/** Unguessable link token (128 bits, URL-safe). */
export const newShareToken = () => randomBytes(16).toString('base64url');
/** A reviewer's browser key is kept only as this hash. */
export const hashKey = (key: string) =>
  createHash('sha256').update(`share-comment:${key}`).digest('base64url');
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
  comments: s.comments === true,
  notify: s.notify !== false,
});
export type ShareView = ReturnType<typeof publicShare> & { openComments?: number };

export async function ownShare(user: SessionUser, token: string) {
  if (!isShareToken(token)) return null;
  const s = await getUserStore().getShare(token);
  return s && s.uid === user.uid ? s : null;
}

/** The share and CV behind a link that takes comments now (link on, comments on, switch on). */
export async function commentableShare(token: string) {
  const r = await resolveShare(token);
  if (!r || !r.share.comments) return null;
  const cfg = (await getBusinessConfig()).value;
  return cfg.features.shareComments ? r : null;
}

/** At most one comment notice per link per hour. */
export const NOTICE_EVERY_MS = 60 * 60 * 1000;

/**
 * Emails the owner that there are new comments (best effort; never throws). Throttled with a
 * shared lease, so a burst of comments sends one email.
 */
export async function noticeComments(share: Share, cvTitle: string, now = new Date()) {
  try {
    if (share.notify === false || !share.ownerEmail) return;
    const store = getUserStore();
    if (!(await store.takeLease(`comment-notice-${share.token}`, NOTICE_EVERY_MS, now))) return;
    const open = (await store.listComments(share.uid, share.docId)).filter(
      (c) => c.status === 'open',
    ).length;
    if (!open) return;
    const cfg = (await getBusinessConfig()).value;
    const r = await sendMail(
      commentEmail(share.ownerEmail, { cvTitle, open, docId: share.docId }),
      cfg.support.email,
    );
    await track(r.ok ? 'comment_notice' : 'comment_notice_fail');
  } catch {
    await track('comment_notice_fail');
  }
}
