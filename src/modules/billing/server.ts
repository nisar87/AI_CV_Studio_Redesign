import 'server-only';
import type { TemplateId } from '@/modules/resume/schema';
import type { SessionUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';
import {
  DEFAULT_CONFIG,
  parseConfig,
  type BusinessConfig,
  type Metered,
  type PlanId,
} from './config';
import { canUse, canUseDesign, monthKey, type Decision } from './gate';

/** Server side of the entitlement gate: config (cached), plan, usage, reservations. */

const CONFIG_AREA = 'business';
const CACHE_MS = 60_000;
let cache: { at: number; value: BusinessConfig; version: number } | null = null;

export async function getBusinessConfig(
  fresh = false,
): Promise<{ value: BusinessConfig; version: number }> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    const stored = await getUserStore().getConfig(CONFIG_AREA);
    cache = {
      at: Date.now(),
      value: stored ? parseConfig(stored.value) : DEFAULT_CONFIG,
      version: stored?.version ?? 0,
    };
  } catch (e) {
    console.error(
      JSON.stringify({ level: 'error', area: 'config', message: (e as Error).message }),
    );
    cache = { at: Date.now(), value: cache?.value ?? DEFAULT_CONFIG, version: cache?.version ?? 0 };
  }
  return cache;
}

export function invalidateConfigCache() {
  cache = null;
}

export async function planFor(
  user: SessionUser | null,
): Promise<{ plan: PlanId; passExpiresAt: string | null }> {
  if (!user) return { plan: 'visitor', passExpiresAt: null };
  const pass = await getUserStore().getPass(user.uid);
  if (pass && pass.expiresAt > new Date().toISOString())
    return { plan: 'premium', passExpiresAt: pass.expiresAt };
  return { plan: 'free', passExpiresAt: pass?.expiresAt ?? null };
}

/**
 * Grant or extend Premium. An active pass is extended from its end, so buying again early never
 * loses days; otherwise the pass starts now. Returns the new expiry.
 */
export async function grantPass(
  uid: string,
  days: number,
  by: string,
  source: 'manual' | 'admin' | 'referral',
  note?: string,
): Promise<string> {
  const store = getUserStore();
  const cur = await store.getPass(uid);
  const now = new Date();
  const from = cur && cur.expiresAt > now.toISOString() ? new Date(cur.expiresAt) : now;
  const expiresAt = new Date(from.getTime() + days * 86_400_000).toISOString();
  await store.setPass(uid, {
    plan: 'premium',
    expiresAt,
    source,
    grantedBy: by,
    grantedAt: now.toISOString(),
    ...(note ? { note: note.slice(0, 200) } : {}),
  });
  return expiresAt;
}

/** Reserve one use of a metered capability. Call release() if the work then fails. */
export async function reserve(
  user: SessionUser | null,
  cap: Metered,
): Promise<{ decision: Decision; release: () => Promise<void>; plan: PlanId }> {
  const noop = async () => {};
  const [{ value: cfg }, { plan }] = await Promise.all([getBusinessConfig(), planFor(user)]);
  if (!user) return { decision: canUse('visitor', cfg, cap, 0), release: noop, plan };
  const month = monthKey();
  const usage = await getUserStore().getUsage(user.uid, month);
  const pre = canUse(plan, cfg, cap, usage[cap] ?? 0);
  if (!pre.ok) return { decision: pre, release: noop, plan };
  const limit = cfg.plans[plan].limits[cap];
  const got = await getUserStore().reserveUsage(user.uid, month, cap, limit);
  if (!got) return { decision: canUse(plan, cfg, cap, limit), release: noop, plan };
  return {
    decision: { ok: true },
    plan,
    release: () => getUserStore().releaseUsage(user.uid, month, cap),
  };
}

export async function checkDesign(user: SessionUser | null, id: TemplateId): Promise<Decision> {
  const [{ value: cfg }, { plan }] = await Promise.all([getBusinessConfig(), planFor(user)]);
  return canUseDesign(plan, cfg, id);
}

/** What the browser may show: plan, limits, usage and the public catalogue. */
export async function entitlementsFor(user: SessionUser | null) {
  const [{ value: cfg }, { plan, passExpiresAt }] = await Promise.all([
    getBusinessConfig(),
    planFor(user),
  ]);
  const usage = user ? await getUserStore().getUsage(user.uid, monthKey()) : {};
  return {
    plan,
    planLabel: cfg.plans[plan].label,
    passExpiresAt,
    limits: cfg.plans[plan].limits,
    usage: {
      'pdf.download': usage['pdf.download'] ?? 0,
      'import.cv': usage['import.cv'] ?? 0,
      'ai.action': usage['ai.action'] ?? 0,
    },
    designs: cfg.designs,
    passes: cfg.passes.filter((p) => p.active),
    features: {
      ai: cfg.features.ai,
      import: cfg.features.import,
      sales: cfg.features.sales,
      signups: cfg.features.signups,
      maintenance: cfg.features.maintenance,
    },
    announcement: cfg.announcement.enabled ? cfg.announcement.text : null,
  };
}
export type Entitlements = Awaited<ReturnType<typeof entitlementsFor>>;

/** Error envelope for a denied decision (docs/engineering/api-contracts.md). */
export function denialCode(d: Exclude<Decision, { ok: true }>) {
  return d.reason === 'sign_in'
    ? ('SIGN_IN_REQUIRED' as const)
    : d.reason === 'premium'
      ? ('PREMIUM_REQUIRED' as const)
      : d.reason === 'limit'
        ? ('LIMIT_REACHED' as const)
        : ('DISABLED' as const);
}
