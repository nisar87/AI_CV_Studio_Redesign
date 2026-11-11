import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig, type BusinessConfig } from './config';
import { canUse, canUseDesign } from './gate';

const cfg: BusinessConfig = {
  ...DEFAULT_CONFIG,
  plans: {
    visitor: { label: 'Visitor', limits: { 'pdf.download': 0, 'import.cv': 0, 'ai.action': 0 } },
    free: { label: 'Free', limits: { 'pdf.download': 3, 'import.cv': 2, 'ai.action': 0 } },
    premium: {
      label: 'Premium',
      limits: { 'pdf.download': -1, 'import.cv': 30, 'ai.action': 300 },
    },
  },
  designs: DEFAULT_CONFIG.designs.map((d) => ({
    ...d,
    tier: d.id === 'clarity' ? 'free' : 'premium',
  })),
};

describe('entitlement gate', () => {
  it('asks visitors to sign in, and free users to upgrade for Premium-only capabilities', () => {
    expect(canUse('visitor', cfg, 'pdf.download', 0)).toMatchObject({
      ok: false,
      reason: 'sign_in',
    });
    expect(canUse('free', cfg, 'ai.action', 0)).toMatchObject({ ok: false, reason: 'premium' });
    expect(canUse('premium', cfg, 'ai.action', 0)).toEqual({ ok: true });
  });

  it('enforces monthly limits, and unlimited means unlimited', () => {
    expect(canUse('free', cfg, 'pdf.download', 2)).toEqual({ ok: true });
    expect(canUse('free', cfg, 'pdf.download', 3)).toMatchObject({
      ok: false,
      reason: 'limit',
      limit: 3,
      used: 3,
    });
    expect(canUse('premium', cfg, 'pdf.download', 99_999)).toEqual({ ok: true });
  });

  it('gates designs by tier and availability', () => {
    expect(canUseDesign('free', cfg, 'clarity')).toEqual({ ok: true });
    expect(canUseDesign('free', cfg, 'vivid')).toMatchObject({ ok: false, reason: 'premium' });
    expect(canUseDesign('premium', cfg, 'vivid')).toEqual({ ok: true });
    const off = {
      ...cfg,
      designs: cfg.designs.map((d) => (d.id === 'vivid' ? { ...d, enabled: false } : d)),
    };
    expect(canUseDesign('premium', off, 'vivid')).toMatchObject({ ok: false, reason: 'disabled' });
  });

  it('feature switches override plans', () => {
    const noAi = { ...cfg, features: { ...cfg.features, ai: false } };
    expect(canUse('premium', noAi, 'ai.action', 0)).toMatchObject({
      ok: false,
      reason: 'disabled',
    });
  });

  it('falls back to defaults for invalid stored config', () => {
    expect(parseConfig({ plans: 'broken' })).toEqual(DEFAULT_CONFIG);
  });
});
