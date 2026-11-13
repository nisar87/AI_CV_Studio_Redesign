import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { denialCode, getBusinessConfig, reserve } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { profileDigest } from '@/modules/jobs/digest';
import { aiBudgetSpent, track } from '@/modules/metrics/server';
import { safeParseResumeDocument } from '@/modules/resume/schema';
import { checkGap, MAX_PLANS, type SkillPlan } from '@/modules/skills/gap';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** GET → { plans, max, enabled } (the signed-in person's skill gap plans). */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const [plans, { value: cfg }] = await Promise.all([
    getUserStore().listSkillPlans(user.uid),
    getBusinessConfig(),
  ]);
  return NextResponse.json({ plans, max: MAX_PLANS, enabled: cfg.features.skillGap }, noStore);
}

/**
 * POST { document, jobId? , role? } → { plan }: a skill gap and learning plan for a tracked job
 * (its advert) or a typed role. One AI action (Premium); kept in the account.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.skillGap)
    return apiError('DISABLED', 'Skill plans are switched off right now.', rid, {
      reason: 'disabled',
    });
  const raw = await readJson(req, 512 * 1024);
  if (!raw.ok) return apiError(raw.code, 'Invalid request.', rid);
  const body = (raw.value ?? {}) as { document?: unknown; jobId?: unknown; role?: unknown };
  const doc = safeParseResumeDocument(body.document);
  if (!doc.success) return apiError('INVALID_INPUT', 'Choose a CV to read.', rid);
  const store = getUserStore();
  let role =
    typeof body.role === 'string' ? body.role.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  let advert = '';
  let jobId = '';
  if (typeof body.jobId === 'string' && body.jobId) {
    const job = /^[\w-]{1,64}$/.test(body.jobId) ? await store.getJob(user.uid, body.jobId) : null;
    if (!job) return apiError('NOT_FOUND', 'Job not found.', rid);
    jobId = job.id;
    role = `${job.title}${job.company ? ` at ${job.company}` : ''}`.slice(0, 160);
    advert = job.advert.trim().slice(0, 12_000);
  }
  if (role.length < 2)
    return apiError('INVALID_INPUT', 'Choose one of your jobs or type the role you want.', rid);
  const plans = await store.listSkillPlans(user.uid);
  if (plans.length >= MAX_PLANS)
    return apiError(
      'LIMIT_REACHED',
      `You can keep up to ${MAX_PLANS} plans. Delete one you no longer need.`,
      rid,
      { reason: 'limit', limit: MAX_PLANS },
    );
  const { provider } = getAiProvider();
  if (!provider) return apiError('AI_UNAVAILABLE', 'AI help is switched off right now.', rid);
  const gate = await reserve(user, 'ai.action', cfg.aiWeights.skillGap);
  if (!gate.decision.ok)
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });
  if (!sharedAiLimiter()(`skills:${user.uid}`).ok || (await aiBudgetSpent())) {
    await gate.release();
    return apiError('RATE_LIMITED', 'Too many requests. Please wait a little.', rid);
  }
  const digest = profileDigest(doc.data);
  const r = await runTask(
    'skills.gap',
    { profile: digest.text.slice(0, 24_000), role, advert },
    0,
    { provider, models: aiModels(), timeoutMs: 50_000 },
  );
  await track(r.ok ? 'ai_ok' : 'ai_fail');
  if (!r.ok) {
    await gate.release();
    return apiError('AI_UNAVAILABLE', 'The plan couldn’t be made just now. Please try again.', rid);
  }
  const now = new Date().toISOString();
  const plan: SkillPlan = {
    id: crypto.randomUUID(),
    role,
    jobId,
    documentId: doc.data.id,
    ...checkGap(r.result, digest),
    createdAt: now,
    updatedAt: now,
  };
  await store.putSkillPlan(user.uid, plan);
  return NextResponse.json({ plan }, noStore);
}
