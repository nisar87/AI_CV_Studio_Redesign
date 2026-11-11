import { adminAuth } from '@/lib/firebase-admin';
import { monthKey } from '@/modules/billing/gate';
import { planFor } from '@/modules/billing/server';
import { json, withAdmin } from '@/modules/admin/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET ?email= → one user's details; without email → recent users and Premium list. */
export function GET(req: Request) {
  return withAdmin(async () => {
    const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase();
    const store = getUserStore();
    if (email) {
      let u;
      try {
        u = await adminAuth().getUserByEmail(email);
      } catch {
        return json({ user: null });
      }
      const [pass, usage, plan] = await Promise.all([
        store.getPass(u.uid),
        store.getUsage(u.uid, monthKey()),
        planFor({
          uid: u.uid,
          email: u.email ?? null,
          emailVerified: u.emailVerified,
          name: null,
          picture: null,
          admin: false,
        }),
      ]);
      return json({
        user: {
          uid: u.uid,
          email: u.email ?? null,
          name: u.displayName ?? null,
          emailVerified: u.emailVerified,
          disabled: u.disabled,
          admin: u.customClaims?.admin === true,
          createdAt: u.metadata.creationTime,
          lastSignInAt: u.metadata.lastSignInTime,
          providers: u.providerData.map((p) => p.providerId),
          plan: plan.plan,
          pass,
          usage,
        },
      });
    }
    const [stats, passes] = await Promise.all([store.userStats(), store.listPasses()]);
    // Show Premium holders by email (Auth lookup in batches of 100).
    const emails = new Map<string, string>();
    for (let i = 0; i < passes.length; i += 100) {
      const r = await adminAuth()
        .getUsers(passes.slice(i, i + 100).map((p) => ({ uid: p.uid })))
        .catch(() => null);
      r?.users.forEach((u) => u.email && emails.set(u.uid, u.email));
    }
    return json({
      recent: stats.recent,
      total: stats.total,
      passes: passes
        .map((p) => ({ ...p, email: emails.get(p.uid) ?? null }))
        .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt)),
    });
  });
}
