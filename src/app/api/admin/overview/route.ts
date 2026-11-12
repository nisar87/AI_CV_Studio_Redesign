import { getBusinessConfig } from '@/modules/billing/server';
import { monthKey } from '@/modules/billing/gate';
import { json, withAdmin } from '@/modules/admin/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return withAdmin(async () => {
    const store = getUserStore();
    const now = new Date().toISOString();
    const month = monthKey();
    const [users, usage, passes, cfg, pending] = await Promise.all([
      store.userStats(),
      store.usageTotals(month),
      store.listPasses(),
      getBusinessConfig(true),
      store.listPaymentRequests({ status: 'pending', limit: 200 }),
    ]);
    return json({
      month,
      users: { total: users.total, recent: users.recent.slice(0, 10) },
      usage: {
        'pdf.download': usage['pdf.download'] ?? 0,
        'import.cv': usage['import.cv'] ?? 0,
        'ai.action': usage['ai.action'] ?? 0,
      },
      payments: { pending: pending.length },
      premium: { active: passes.filter((p) => p.expiresAt > now).length, total: passes.length },
      config: {
        version: cfg.version,
        sales: cfg.value.features.sales,
        ai: cfg.value.features.ai,
        maintenance: cfg.value.features.maintenance,
      },
      aiProvider: process.env.AI_PROVIDER ?? (process.env.GEMINI_API_KEY ? 'gemini' : 'off'),
    });
  });
}
