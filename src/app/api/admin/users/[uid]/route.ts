import { adminAuth } from '@/lib/firebase-admin';
import { apiError, readJson } from '@/lib/http';
import { monthKey } from '@/modules/billing/gate';
import { grantPass } from '@/modules/billing/server';
import { actor, json, withAdmin } from '@/modules/admin/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body =
  | { action: 'grant'; days: number; note?: string }
  | { action: 'revoke'; note?: string }
  | { action: 'resetUsage' }
  | { action: 'disable' | 'enable' };

/** POST — grant/extend or revoke Premium, reset this month's usage, disable/enable sign-in. */
export function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  return withAdmin(async (admin, rid) => {
    const { uid } = await ctx.params;
    if (!/^[\w-]{1,128}$/.test(uid)) return apiError('INVALID_INPUT', 'Invalid user.', rid);
    const body = await readJson(req, 4 * 1024);
    if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
    const b = body.value as Body;
    const store = getUserStore();
    const by = actor(admin);
    const audit = (action: string, detail?: unknown) =>
      store.writeAudit({ at: new Date().toISOString(), by, action, target: uid, detail });

    if (b.action === 'grant') {
      const days = Math.floor(Number(b.days));
      if (!(days >= 1 && days <= 3660))
        return apiError('INVALID_INPUT', 'Days must be between 1 and 3660.', rid);
      const expiresAt = await grantPass(
        uid,
        days,
        by,
        'admin',
        b.note ? String(b.note) : undefined,
      );
      await audit('pass.grant', { days, expiresAt, note: b.note ?? null });
      return json({ ok: true, expiresAt });
    }
    if (b.action === 'revoke') {
      await store.setPass(uid, null);
      await audit('pass.revoke', { note: b.note ?? null });
      return json({ ok: true });
    }
    if (b.action === 'resetUsage') {
      const month = monthKey();
      const usage = await store.getUsage(uid, month);
      for (const [k, n] of Object.entries(usage))
        for (let i = 0; i < n; i++) await store.releaseUsage(uid, month, k);
      await audit('usage.reset', { month, before: usage });
      return json({ ok: true });
    }
    if (b.action === 'disable' || b.action === 'enable') {
      if (uid === admin.uid)
        return apiError('INVALID_INPUT', 'You cannot disable your own account.', rid);
      await adminAuth().updateUser(uid, { disabled: b.action === 'disable' });
      if (b.action === 'disable') await adminAuth().revokeRefreshTokens(uid);
      await audit(`user.${b.action}`);
      return json({ ok: true });
    }
    return apiError('INVALID_INPUT', 'Unknown action.', rid);
  });
}
