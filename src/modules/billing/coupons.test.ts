import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type BusinessConfig } from './config';
import { checkCoupon, normaliseCode, quote } from './coupons';

const cfg: BusinessConfig = {
  ...DEFAULT_CONFIG,
  coupons: [
    {
      code: 'LAUNCH20',
      percentOff: 20,
      extraDays: 0,
      passIds: [],
      maxUses: 2,
      expiresOn: '2026-12-31',
      active: true,
    },
    {
      code: 'QTR-BONUS',
      percentOff: 0,
      extraDays: 15,
      passIds: ['quarter'],
      maxUses: 0,
      expiresOn: '',
      active: true,
    },
    {
      code: 'OFF',
      percentOff: 50,
      extraDays: 0,
      passIds: [],
      maxUses: 0,
      expiresOn: '',
      active: false,
    },
  ],
};
const month = cfg.passes[0]!;
const quarter = cfg.passes[1]!;
const at = new Date('2026-11-12T10:00:00Z');

describe('coupons', () => {
  it('normalises what people type', () => {
    expect(normaliseCode(' launch 20 ')).toBe('LAUNCH20');
  });
  it('applies a percentage, rounding to whole rupees', () => {
    const c = checkCoupon(cfg, 'launch20', month, 0, at);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(quote(month, c.coupon, 0)).toEqual({
      passId: 'month',
      listPricePkr: 499,
      pricePkr: 399,
      days: 30,
      couponCode: 'LAUNCH20',
      welcomeDays: 0,
    });
  });
  it('adds extra days, only for the passes it names', () => {
    const c = checkCoupon(cfg, 'QTR-BONUS', quarter, 0, at);
    expect(c.ok && quote(quarter, c.coupon, 7).days).toBe(90 + 15 + 7);
    const m = checkCoupon(cfg, 'QTR-BONUS', month, 0, at);
    expect(m).toEqual({ ok: false, message: 'That code can’t be used for the 1 month pass.' });
  });
  it('refuses unknown, switched-off, expired and used-up codes', () => {
    expect(checkCoupon(cfg, 'NOPE', month, 0, at).ok).toBe(false);
    expect(checkCoupon(cfg, 'OFF', month, 0, at).ok).toBe(false);
    expect(checkCoupon(cfg, 'LAUNCH20', month, 0, new Date('2027-01-01T00:00:00Z'))).toMatchObject({
      message: 'That code has expired.',
    });
    expect(checkCoupon(cfg, 'LAUNCH20', month, 2, at)).toMatchObject({
      message: 'That code has been used up.',
    });
  });
  it('without a coupon, the welcome bonus still adds days', () => {
    expect(quote(month, null, 7)).toMatchObject({ pricePkr: 499, days: 37, welcomeDays: 7 });
  });
});
