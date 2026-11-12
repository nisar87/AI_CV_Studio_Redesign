import type { BusinessConfig } from './config';

type Pass = BusinessConfig['passes'][number];
export type Coupon = BusinessConfig['coupons'][number];

export const normaliseCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

/** What a buyer pays and gets for a pass, with an optional coupon and welcome bonus. */
export type Quote = {
  passId: string;
  listPricePkr: number;
  pricePkr: number;
  days: number;
  couponCode?: string;
  /** Extra days from a friend's invite (first purchase only). */
  welcomeDays: number;
};

/**
 * Checks a coupon for a pass. `uses` = purchases already made with it (pending or approved).
 * Returns a plain-language reason when it can't be used.
 */
export function checkCoupon(
  cfg: BusinessConfig,
  rawCode: string,
  pass: Pass,
  uses: number,
  now = new Date(),
): { ok: true; coupon: Coupon } | { ok: false; message: string } {
  const code = normaliseCode(rawCode);
  const c = cfg.coupons.find((x) => x.code === code);
  if (!c || !c.active) return { ok: false, message: 'That code isn’t valid. Please check it.' };
  if (c.expiresOn && now.toISOString().slice(0, 10) > c.expiresOn)
    return { ok: false, message: 'That code has expired.' };
  if (c.passIds.length && !c.passIds.includes(pass.id))
    return { ok: false, message: `That code can’t be used for the ${pass.label} pass.` };
  if (c.maxUses > 0 && uses >= c.maxUses)
    return { ok: false, message: 'That code has been used up.' };
  return { ok: true, coupon: c };
}

export function quote(pass: Pass, coupon: Coupon | null, welcomeDays: number): Quote {
  const off = coupon ? Math.round((pass.pricePkr * coupon.percentOff) / 100) : 0;
  return {
    passId: pass.id,
    listPricePkr: pass.pricePkr,
    pricePkr: Math.max(0, pass.pricePkr - off),
    days: pass.days + (coupon?.extraDays ?? 0) + welcomeDays,
    ...(coupon ? { couponCode: coupon.code } : {}),
    welcomeDays,
  };
}
