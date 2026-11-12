import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryUserStore } from '@/modules/store/memory';

vi.mock('@/lib/firebase-admin', () => ({ adminDb: () => null }));

describe('shared daily AI budget', () => {
  afterEach(() => {
    delete (globalThis as { __cvStudioStore?: unknown }).__cvStudioStore;
    delete process.env.AI_DAILY_BUDGET;
    vi.resetModules();
  });

  it('counts AI calls from every instance (shared counters), with a short cache', async () => {
    const store = new MemoryUserStore();
    (globalThis as { __cvStudioStore?: unknown }).__cvStudioStore = store;
    process.env.AI_DAILY_BUDGET = '5';
    const m = await import('./server');
    const day = m.today();
    // Other instances already made 4 calls today.
    await store.bumpMetrics(day, { ai_ok: 3, import_ai: 1 });
    const t0 = Date.now();
    expect(await m.aiCallsToday(t0)).toBe(4);
    expect(await m.aiBudgetSpent()).toBe(false);
    await store.bumpMetrics(day, { ai_fail: 1 });
    // Within 20 s the cached number is used; after that the new total is read.
    expect(await m.aiCallsToday(t0 + 5_000)).toBe(4);
    expect(await m.aiCallsToday(t0 + 25_000)).toBe(5);
  });
});
