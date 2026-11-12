import { apiError, readJson } from '@/lib/http';
import { grantPass } from '@/modules/billing/server';
import { actor, json, withAdmin } from '@/modules/admin/server';
import { getUserStore } from '@/modules/store';

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
    let expiresAt: string | null = null;
    if (decided.status === 'approved')
      expiresAt = await grantPass(
        decided.uid,
        decided.days,
        by,
        'manual',
        `${decided.passLabel} · ${decided.methodLabel} ${decided.reference}`,
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
        method: decided.methodLabel,
        reference: decided.reference,
        ...(expiresAt ? { expiresAt } : { reason: why }),
      },
    });
    return json({ ok: true, status: decided.status, expiresAt });
  });
}
