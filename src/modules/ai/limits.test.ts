import { describe, expect, it, vi } from 'vitest';
import { createAiLimiter } from './limits';

describe('budget warning', () => {
  it('logs ai_budget_80 once when 80% of the daily budget is used', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const take = createAiLimiter({ per10Min: 100, perDay: 100, dailyBudget: 10 }, () => 0);
    for (let i = 0; i < 10; i++) take(`k${i}`);
    const hits = warn.mock.calls.filter((c) => String(c[0]).includes('ai_budget_80'));
    expect(hits).toHaveLength(1);
    warn.mockRestore();
  });
});
