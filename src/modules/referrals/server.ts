import 'server-only';
import { randomInt } from 'node:crypto';
import { cookies } from 'next/headers';
import { getUserStore } from '@/modules/store';

/** Invite codes: 8 characters without look-alikes (no 0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeReferralCode = () =>
  Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
export const isReferralCode = (c: string) => /^[A-Z2-9]{8}$/.test(c);

export const REF_COOKIE = 'cvs_ref';

/** On a brand-new account: remember who invited them (from the invite-link cookie). */
export async function recordInvite(uid: string): Promise<boolean> {
  const jar = await cookies();
  const code = jar.get(REF_COOKIE)?.value ?? '';
  if (!code) return false;
  jar.delete(REF_COOKIE);
  if (!isReferralCode(code)) return false;
  const store = getUserStore();
  const owner = await store.referralOwner(code);
  if (!owner || owner === uid) return false;
  await store.setReferredBy(uid, owner);
  return true;
}
