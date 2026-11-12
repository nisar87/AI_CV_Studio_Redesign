import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { getUserStore } from '@/modules/store';

/**
 * Server records for a makeover, kept in the existing usage counters (no new collection):
 *   usage/mk_<id>_polish  { issued, paid, claimed, wording }
 *   usage/pv_<who>_d<day> { makeover }   — previews per visitor/account per day
 * Only counts are stored; never CV content.
 */
const mk = (id: string) => `mk_${id}`;
const MK_MONTH = 'polish';

export const VISITOR_PREVIEWS_PER_DAY = Number(process.env.MAKEOVER_VISITOR_PER_DAY ?? 3);
export const ACCOUNT_PREVIEWS_PER_DAY = Number(process.env.MAKEOVER_PREVIEW_PER_DAY ?? 1);

const ID_RE = /^[0-9a-f-]{36}$/;
export const validMakeoverId = (id: unknown): id is string =>
  typeof id === 'string' && ID_RE.test(id);

/** Registers a new makeover; `paid` when its import allowance was already counted. */
export async function issueMakeover(paid: boolean): Promise<string> {
  const id = randomUUID();
  const store = getUserStore();
  await store.reserveUsage(mk(id), MK_MONTH, 'issued', 1);
  if (paid) await store.reserveUsage(mk(id), MK_MONTH, 'paid', 1);
  return id;
}

export async function makeoverRecord(id: string) {
  if (!validMakeoverId(id)) return null;
  const u = await getUserStore().getUsage(mk(id), MK_MONTH);
  if (u.issued !== 1) return null;
  return { paid: (u.paid ?? 0) >= 1, claimed: (u.claimed ?? 0) >= 1 };
}

/** Marks the makeover as saved to an account (once). */
export function markClaimed(id: string): Promise<boolean> {
  return getUserStore().reserveUsage(mk(id), MK_MONTH, 'claimed', 1);
}

/** "Fix wording" is free once per makeover (spec §6.4); later uses need an AI allowance. */
export function takeFreeWording(id: string): Promise<boolean> {
  return getUserStore().reserveUsage(mk(id), MK_MONTH, 'wording', 1);
}
export function giveBackFreeWording(id: string): Promise<void> {
  return getUserStore().releaseUsage(mk(id), MK_MONTH, 'wording');
}

const day = () => new Date().toISOString().slice(0, 10);
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24);

/** One preview slot for today (visitors by hashed network address, accounts by id). */
export async function takePreview(who: { uid?: string; ip: string }) {
  const key = who.uid ? `pv_u${hash(who.uid)}` : `pv_v${hash(who.ip)}`;
  const limit = who.uid ? ACCOUNT_PREVIEWS_PER_DAY : VISITOR_PREVIEWS_PER_DAY;
  const month = `d${day()}`;
  const ok = await getUserStore().reserveUsage(key, month, 'makeover', limit);
  return { ok, release: () => getUserStore().releaseUsage(key, month, 'makeover') };
}
