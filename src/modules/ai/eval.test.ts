import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('live evaluation set (dry run with the demo provider)', () => {
  it('every sample runs, validates and passes its checks', async () => {
    const { evalSamples, runEvalSample } = await import('./eval');
    const { createMockProvider } = await import('./providers/mock');
    const mockProvider = createMockProvider();
    const n = evalSamples().length;
    expect(evalSamples().filter((s) => s.task === 'interview.turn')).toHaveLength(12);
    for (let i = 0; i < n; i++) {
      const r = await runEvalSample(i, {
        provider: mockProvider,
        models: { fast: 'f', smart: 's' },
      });
      expect(r.ok, `${r.name}: ${r.error}`).toBe(true);
      expect(r.residual, r.name).toEqual([]);
    }
  });
});
