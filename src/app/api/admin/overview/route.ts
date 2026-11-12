import { getBusinessConfig } from '@/modules/billing/server';
import { monthKey } from '@/modules/billing/gate';
import { json, withAdmin } from '@/modules/admin/server';
import { metricsSummary } from '@/modules/metrics/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return withAdmin(async () => {
    const store = getUserStore();
    const now = new Date().toISOString();
    const month = monthKey();
    const [users, usage, passes, cfg, pending, metrics] = await Promise.all([
      store.userStats(),
      store.usageTotals(month),
      store.listPasses(),
      getBusinessConfig(true),
      store.listPaymentRequests({ status: 'pending', limit: 200 }),
      metricsSummary(30),
    ]);
    const t = metrics.total;
    const d = metrics.today;
    const n = (o: Record<string, number>, k: string) => o[k] ?? 0;
    return json({
      month,
      users: { total: users.total, recent: users.recent.slice(0, 10) },
      usage: {
        'pdf.download': usage['pdf.download'] ?? 0,
        'import.cv': usage['import.cv'] ?? 0,
        'ai.action': usage['ai.action'] ?? 0,
      },
      payments: { pending: pending.length },
      // Success numbers (master plan §6), last 30 days unless marked "today".
      numbers: {
        from: metrics.from,
        newAccounts: n(t, 'account_new'),
        visitorsAtDownload: n(t, 'pdf_denied_signin'),
        pdfs: n(t, 'pdf_ok'),
        words: n(t, 'docx_ok'),
        shareViews: n(t, 'share_view'),
        portfolioViews: n(t, 'portfolio_view'),
        invitesJoined: n(t, 'referral_joined'),
        inviteRewards: n(t, 'referral_reward'),
        couponsUsed: n(t, 'coupon_used'),
        hitDownloadLimit: n(t, 'pdf_denied_limit'),
        imports: n(t, 'import_ok'),
        importsWithAi: n(t, 'import_ai'),
        importFailures: n(t, 'import_fail'),
        aiActions: n(t, 'ai_ok'),
        aiFailures: n(t, 'ai_fail'),
        aiCallsToday: n(d, 'ai_ok') + n(d, 'ai_fail') + n(d, 'import_ai'),
        aiDailyBudget: Number(process.env.AI_DAILY_BUDGET) || 2000,
        premiumRequests: n(t, 'premium_request'),
        premiumApproved: n(t, 'premium_approved'),
        premiumRejected: n(t, 'premium_rejected'),
        avgApprovalMinutes: n(t, 'premium_approved')
          ? Math.round(n(t, 'premium_approval_minutes') / n(t, 'premium_approved'))
          : null,
        daily: metrics.days.map((x) => ({
          day: x.day,
          accounts: n(x.counts, 'account_new'),
          pdfs: n(x.counts, 'pdf_ok'),
          imports: n(x.counts, 'import_ok'),
          ai: n(x.counts, 'ai_ok'),
        })),
      },
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
