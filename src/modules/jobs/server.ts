import 'server-only';
import { getBusinessConfig, planFor } from '@/modules/billing/server';
import type { SessionUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';
import { jobInput, type Job } from './schema';

/** How many jobs this person may track (-1 = no limit). */
export async function jobAllowance(user: SessionUser) {
  const [{ plan }, { value: cfg }] = await Promise.all([planFor(user), getBusinessConfig()]);
  return { plan, max: cfg.plans[plan].maxJobs };
}

/** Applies a partial update; moving to "applied" stamps today's date if none was set. */
export function applyJobPatch(cur: Job, patch: unknown, now = new Date()): Job | { error: string } {
  const merged = jobInput.safeParse({ ...cur, ...(patch as object) });
  if (!merged.success) return { error: merged.error.issues[0]?.message ?? 'Invalid job.' };
  const next: Job = { ...cur, ...merged.data, updatedAt: now.toISOString() };
  if (next.stage === 'applied' && cur.stage !== 'applied' && !next.appliedOn)
    next.appliedOn = now.toISOString().slice(0, 10);
  return next;
}

export async function listJobs(uid: string) {
  return getUserStore().listJobs(uid);
}
