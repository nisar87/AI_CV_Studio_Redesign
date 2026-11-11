import type { TemplateId } from '@/modules/resume/schema';
import type { BusinessConfig, Metered, PlanId } from './config';

/**
 * The single entitlement decision (studio-master-plan §4.3). Pure: callers pass the plan, the
 * config and this month's usage. Server routes call it; the UI only displays its answers.
 */
export type Denial =
  | { ok: false; reason: 'sign_in'; message: string }
  | { ok: false; reason: 'premium'; message: string }
  | { ok: false; reason: 'limit'; message: string; limit: number; used: number }
  | { ok: false; reason: 'disabled'; message: string };
export type Decision = { ok: true } | Denial;

const NOUN: Record<Metered, string> = {
  'pdf.download': 'PDF downloads',
  'import.cv': 'CV imports',
  'ai.action': 'AI actions',
};

export function canUseDesign(plan: PlanId, cfg: BusinessConfig, id: TemplateId): Decision {
  const d = cfg.designs.find((x) => x.id === id);
  if (!d || !d.enabled)
    return { ok: false, reason: 'disabled', message: 'This design is not available right now.' };
  if (d.tier === 'premium' && plan !== 'premium')
    return { ok: false, reason: 'premium', message: 'This design is part of Premium.' };
  return { ok: true };
}

export function canUse(plan: PlanId, cfg: BusinessConfig, cap: Metered, used: number): Decision {
  if (cfg.features.maintenance)
    return {
      ok: false,
      reason: 'disabled',
      message: 'The studio is being updated. Please try again in a little while.',
    };
  if (cap === 'ai.action' && !cfg.features.ai)
    return { ok: false, reason: 'disabled', message: 'AI help is switched off right now.' };
  if (cap === 'import.cv' && !cfg.features.import)
    return { ok: false, reason: 'disabled', message: 'Importing is switched off right now.' };
  const limit = cfg.plans[plan].limits[cap];
  if (limit === -1) return { ok: true };
  if (limit === 0) {
    if (plan === 'visitor')
      return {
        ok: false,
        reason: 'sign_in',
        message: 'Please sign in or create a free account to continue.',
      };
    return { ok: false, reason: 'premium', message: `${NOUN[cap]} are part of Premium.` };
  }
  if (used >= limit)
    return {
      ok: false,
      reason: 'limit',
      limit,
      used,
      message: `You have used all ${limit} ${NOUN[cap]} for this month.${plan === 'premium' ? '' : ' Premium gives you more.'}`,
    };
  return { ok: true };
}

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
