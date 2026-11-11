import { NextResponse } from 'next/server';
import { businessConfig, DEFAULT_CONFIG } from '@/modules/billing/config';
import { invalidateConfigCache } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * End-to-end test hooks. Exists only when E2E_TEST_HOOKS=1 AND the in-memory store is in use, so
 * it can never touch production data. Body: { premium?: boolean, config?: BusinessConfig }.
 */
const enabled = () => process.env.E2E_TEST_HOOKS === '1' && process.env.DATA_STORE === 'memory';

export async function POST(req: Request) {
  if (!enabled()) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    premium?: boolean;
    config?: unknown;
    resetConfig?: boolean;
  };
  const store = getUserStore();
  if (body.resetConfig) {
    await store.saveConfig('business', DEFAULT_CONFIG, 'test');
    invalidateConfigCache();
  }
  if (body.config !== undefined) {
    const parsed = businessConfig.safeParse(body.config);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    await store.saveConfig('business', parsed.data, 'test');
    invalidateConfigCache();
  }
  if (body.premium !== undefined) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'sign in first' }, { status: 401 });
    await store.setPass(
      user.uid,
      body.premium
        ? {
            plan: 'premium',
            expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
            source: 'admin',
            grantedBy: 'test',
            grantedAt: new Date().toISOString(),
          }
        : null,
    );
  }
  return NextResponse.json({ ok: true });
}
