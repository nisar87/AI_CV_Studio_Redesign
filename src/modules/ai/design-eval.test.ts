import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { allDesignSamples, designSamples, hue, runDesignSample } from './design-eval';
import { createMockProvider } from './providers/mock';

describe('AI Designer acceptance set', () => {
  it('has 60 written descriptions, refine samples and an injection sample', () => {
    expect(designSamples()).toHaveLength(60);
    const kinds = allDesignSamples().map((s) => s.kind);
    expect(kinds.filter((k) => k === 'refine').length).toBeGreaterThanOrEqual(6);
    expect(kinds).toContain('inject');
  });

  it('reads colour families', () => {
    expect(hue('#1f3a5f')).toBe('blue');
    expect(hue('#2d6a3e')).toBe('green');
    expect(hue('#7a2e4d')).toBe('red');
    expect(hue('#333333')).toBe('grey');
  });

  it('runs every sample end to end (mock model)', async () => {
    const deps = { provider: createMockProvider(), models: { fast: 'f', smart: 's' } };
    const n = allDesignSamples().length;
    for (let i = 0; i < n; i++) {
      const r = await runDesignSample(i, deps);
      expect(r.ok, `${r.name}: ${r.error ?? JSON.stringify(r.extra ?? r.missed)}`).toBe(true);
    }
  });
});
