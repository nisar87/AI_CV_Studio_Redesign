import { apiError, readJson } from '@/lib/http';
import { getBusinessConfig, grantPass } from '@/modules/billing/server';
import { actor, json, withAdmin } from '@/modules/admin/server';
import { track } from '@/modules/metrics/server';
import { getUserStore } from '@/modules/store';
import { paymentEmail, sendMail } from '@/modules/notify/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST { decision: 'approve' | 'reject', reason? } — approving grants (or extends) the pass. */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAdmin(async (admin, rid) => {
    const { id } = await ctx.params;
    if (!/^[\w-]{1,128}$/.test(id)) return apiError('INVALID_INPUT', 'Invalid request id.', rid);
    const body = await readJson(req, 4 * 1024);
    if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
    const { decision, reason } = body.value as { decision?: string; reason?: unknown };
    if (decision !== 'approve' && decision !== 'reject')
      return apiError('INVALID_INPUT', 'Choose approve or reject.', rid);
    const why = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
    if (decision === 'reject' && !why)
      return apiError('INVALID_INPUT', 'Please give the buyer a reason.', rid);
    const store = getUserStore();
    const by = actor(admin);
    // The transaction claims the request first, so two admins can never approve it twice.
    const decided = await store.decidePaymentRequest(id, {
      status: decision === 'approve' ? 'approved' : 'rejected',
      by,
      ...(why ? { reason: why } : {}),
    });
    if (!decided)
      return json(
        { error: { code: 'CONFLICT', message: 'This request was already handled.' } },
        409,
      );
    await track(decided.status === 'approved' ? 'premium_approved' : 'premium_rejected');
    if (decided.status === 'approved')
      await track(
        'premium_approval_minutes',
        Math.max(0, Math.round((Date.now() - Date.parse(decided.createdAt)) / 60_000)),
      );
    let expiresAt: string | null = null;
    if (decided.status === 'approved')
      expiresAt = await grantPass(
        decided.uid,
        decided.days,
        by,
        'manual',
        `${decided.passLabel} · ${decided.methodLabel} · order ${decided.orderNo ?? decided.reference}`,
      );
    await store.writeAudit({
      at: new Date().toISOString(),
      by,
      action: decided.status === 'approved' ? 'payment.approve' : 'payment.reject',
      target: decided.email ?? decided.uid,
      detail: {
        request: id,
        pass: decided.passLabel,
        pricePkr: decided.pricePkr,
        ...(decided.couponCode ? { coupon: decided.couponCode } : {}),
        method: decided.methodLabel,
        ...(decided.orderNo ? { order: decided.orderNo } : {}),
        ...(decided.phone ? { mobile: decided.phone } : {}),
        ...(decided.reference ? { reference: decided.reference } : {}),
        ...(expiresAt ? { expiresAt } : { reason: why }),
      },
    });
    if (decided.status === 'approved' && decided.couponCode) await track('coupon_used');
    // Invite reward: the inviter gets Premium days when the friend's first purchase is approved.
    if (decided.status === 'approved' && decided.referrerUid) {
      const { value: cfg } = await getBusinessConfig();
      const earlier = await store.listPaymentRequests({
        uid: decided.uid,
        status: 'approved',
        limit: 50,
      });
      const first = !earlier.some((p) => p.id !== decided.id);
      if (cfg.referrals.enabled && cfg.referrals.rewardDays > 0 && first) {
        const until = await grantPass(
          decided.referrerUid,
          cfg.referrals.rewardDays,
          by,
          'referral',
          `Invite reward: ${decided.email ?? 'a friend'} bought ${decided.passLabel}`,
        );
        await track('referral_reward');
        await store.writeAudit({
          at: new Date().toISOString(),
          by,
          action: 'referral.reward',
          target: decided.referrerUid,
          detail: {
            friend: decided.email ?? decided.uid,
            days: cfg.referrals.rewardDays,
            expiresAt: until,
          },
        });
      }
    }
    // Tell the buyer (never blocks the decision; a failure is logged and shown to the admin).
    const { value: cfgNow } = await getBusinessConfig();
    const mail = paymentEmail(decided, {
      expiresAt,
      reason: why,
      supportEmail: cfgNow.support.email,
    });
    const emailed = mail
      ? await sendMail(mail, cfgNow.support.email)
      : ({ ok: false, reason: 'no_recipient' } as const);
    return json({
      ok: true,
      status: decided.status,
      expiresAt,
      emailed: emailed.ok,
      ...(emailed.ok ? {} : { emailProblem: emailed.reason }),
    });
  });
}
