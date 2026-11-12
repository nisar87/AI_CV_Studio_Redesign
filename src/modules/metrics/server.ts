import 'server-only';
import { getUserStore } from '@/modules/store';

/**
 * Product numbers (master plan §6 success measures), counted on the server. Only event names
 * and counts are stored — never CV content, names or emails. Failures never affect the request.
 */
export const EVENTS = [
  'account_new',
  'signin',
  'pdf_ok',
  'docx_ok',
  'share_view',
  'portfolio_view',
  'pdf_denied_signin',
  'pdf_denied_limit',
  'pdf_denied_premium',
  'import_ok',
  'import_ai',
  'import_rules',
  'import_fail',
  'ai_ok',
  'ai_fail',
  'premium_request',
  'premium_approved',
  'premium_rejected',
  'premium_approval_minutes',
  'referral_joined',
  'referral_reward',
  'coupon_used',
] as const;
export type MetricEvent = (typeof EVENTS)[number];

export const today = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * Counts an event. Callers await it: on Cloud Run, work still running after the response is sent
 * may never finish, which would undercount. Never throws.
 */
export function track(event: MetricEvent, n = 1): Promise<void> {
  return getUserStore()
    .bumpMetrics(today(), { [event]: n })
    .catch((e: Error) =>
      console.warn(JSON.stringify({ level: 'warn', area: 'metrics', event, message: e.message })),
    );
}

/** Totals over the last `days` days (including today), plus today's numbers. */
export async function metricsSummary(days = 30) {
  const to = today();
  const from = today(new Date(Date.now() - (days - 1) * 86_400_000));
  const rows = await getUserStore().getMetrics(from, to);
  const sum: Record<string, number> = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.counts)) sum[k] = (sum[k] ?? 0) + v;
  const todayRow = rows.find((r) => r.day === to)?.counts ?? {};
  return { from, to, days: rows, total: sum, today: todayRow };
}
