import 'server-only';
import type { SessionUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';
import type { BusinessConfig } from './config';
import { checkCoupon, quote, type Quote } from './coupons';

/**
 * The price and days for this person and pass, with an optional coupon and, on a first purchase
 * by someone a friend invited, the welcome bonus. Shared by the preview and the purchase request.
 */
export async function quoteFor(
  user: SessionUser,
  cfg: BusinessConfig,
  passId: string,
  code?: string,
): Promise<{ ok: true; quote: Quote; referrerUid?: string } | { ok: false; message: string }> {
  const pass = cfg.passes.find((p) => p.id === passId && p.active);
  if (!pass) return { ok: false, message: 'That option is no longer available. Please reload.' };
  const store = getUserStore();
  let coupon = null;
  if (code?.trim()) {
    const c = checkCoupon(cfg, code, pass, await store.countCouponUses(code.trim().toUpperCase()));
    if (!c.ok) return c;
    coupon = c.coupon;
  }
  let welcome = 0;
  let referrerUid: string | undefined;
  if (cfg.referrals.enabled) {
    const by = await store.getReferredBy(user.uid);
    if (by) {
      const before = await store.listPaymentRequests({ uid: user.uid, limit: 50 });
      if (!before.some((p) => p.status === 'pending' || p.status === 'approved')) {
        welcome = cfg.referrals.welcomeDays;
        referrerUid = by;
      }
    }
  }
  return { ok: true, quote: quote(pass, coupon, welcome), ...(referrerUid ? { referrerUid } : {}) };
}
