import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/modules/billing/config';
import { diffSummary } from './diff';

describe('diffSummary', () => {
  it('is empty when nothing changed', () => {
    expect(diffSummary(DEFAULT_CONFIG, structuredClone(DEFAULT_CONFIG))).toEqual([]);
  });

  it('names changed leaves by path, and list items by id', () => {
    const next = structuredClone(DEFAULT_CONFIG);
    next.plans.free.limits['pdf.download'] = 5;
    next.features.sales = true;
    const vivid = next.designs.find((d) => d.id === 'vivid');
    if (vivid) vivid.tier = 'premium';
    expect(diffSummary(DEFAULT_CONFIG, next).sort()).toEqual(
      [
        'designs[vivid].tier: "free" → "premium"',
        'features.sales: false → true',
        'plans.free.limits.pdf.download: 30 → 5',
      ].sort(),
    );
  });

  it('reports added and removed list items', () => {
    const next = structuredClone(DEFAULT_CONFIG);
    next.passes = next.passes.filter((p) => p.id !== 'quarter');
    next.passes.push({ id: 'year', label: '1 year', days: 365, pricePkr: 3999, active: true });
    const out = diffSummary(DEFAULT_CONFIG, next);
    expect(out.some((l) => l.startsWith('passes[quarter]: {'))).toBe(true);
    expect(out.some((l) => l.startsWith('passes[year]: —'))).toBe(true);
  });
});

describe('discount codes', () => {
  it('names a new code by its code', () => {
    const code = { code: 'LAUNCH20', percentOff: 20, active: true };
    expect(diffSummary({ coupons: [] }, { coupons: [code] })).toEqual([
      `coupons[LAUNCH20]: — → ${JSON.stringify(code)}`,
    ]);
    expect(diffSummary({ coupons: [code] }, { coupons: [{ ...code, active: false }] })).toEqual([
      'coupons[LAUNCH20].active: true → false',
    ]);
  });
});
