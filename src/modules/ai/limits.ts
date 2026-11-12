/**
 * Fair-use limits and the daily cost switch (docs/engineering/ai-architecture.md → Errors, limits
 * and cost). In-memory per server instance; move to a shared store (KV) when scaling out.
 */
export type AiLimits = {
  per10Min: number;
  perDay: number;
  dailyBudget: number;
};

export function limitsFromEnv(env: NodeJS.ProcessEnv = process.env): AiLimits {
  const n = (v: string | undefined, d: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 && v !== undefined && v !== '' ? x : d;
  };
  return {
    per10Min: n(env.AI_REQUESTS_PER_10_MIN, 30),
    perDay: n(env.AI_REQUESTS_PER_DAY, 150),
    dailyBudget: n(env.AI_DAILY_BUDGET, 2000),
  };
}

export type LimitResult =
  | { ok: true; remainingToday: number }
  | { ok: false; reason: 'burst' | 'daily' | 'budget'; retryAfterSec: number };

export function createAiLimiter(limits: AiLimits, now: () => number = Date.now) {
  const burst = new Map<string, number[]>();
  const daily = new Map<string, number>();
  let day = '';
  let globalCount = 0;

  const today = () => new Date(now()).toISOString().slice(0, 10);
  const secondsToMidnight = () => {
    const t = now();
    const next = new Date(t);
    next.setUTCHours(24, 0, 0, 0);
    return Math.ceil((next.getTime() - t) / 1000);
  };

  return function take(key: string): LimitResult {
    const d = today();
    if (d !== day) {
      day = d;
      daily.clear();
      globalCount = 0;
    }
    if (globalCount >= limits.dailyBudget)
      return { ok: false, reason: 'budget', retryAfterSec: secondsToMidnight() };
    const used = daily.get(key) ?? 0;
    if (used >= limits.perDay)
      return { ok: false, reason: 'daily', retryAfterSec: secondsToMidnight() };
    const t = now();
    const recent = (burst.get(key) ?? []).filter((x) => t - x < 600_000);
    if (recent.length >= limits.per10Min) {
      burst.set(key, recent);
      return {
        ok: false,
        reason: 'burst',
        retryAfterSec: Math.max(1, Math.ceil((recent[0]! + 600_000 - t) / 1000)),
      };
    }
    recent.push(t);
    burst.set(key, recent);
    daily.set(key, used + 1);
    globalCount++;
    if (burst.size > 20_000) burst.clear();
    if (daily.size > 50_000) daily.clear();
    return { ok: true, remainingToday: limits.perDay - used - 1 };
  };
}

/** One limiter per server instance, shared by every route that calls the model (one budget). */
export function sharedAiLimiter(): ReturnType<typeof createAiLimiter> {
  const g = globalThis as { __aiLimiter?: ReturnType<typeof createAiLimiter> };
  return (g.__aiLimiter ??= createAiLimiter(limitsFromEnv()));
}
