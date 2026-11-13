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
import { storyPoints } from '@/modules/stories/points';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/**
 * POST { document, point, notes? } → { draft }: a STAR story drafted from one CV point (an AI
 * action, Premium). Nothing is saved; the person edits the draft and saves it themselves.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.stories)
    return apiError('DISABLED', 'The story bank is switched off right now.', rid, {
      reason: 'disabled',
    });
  const raw = await readJson(req, 512 * 1024);
  if (!raw.ok) return apiError(raw.code, 'Invalid request.', rid);
  const body = (raw.value ?? {}) as { document?: unknown; point?: unknown; notes?: unknown };
  const doc = safeParseResumeDocument(body.document);
  if (!doc.success) return apiError('INVALID_INPUT', 'Choose a CV to draft from.', rid);
  const digest = profileDigest(doc.data);
  const point = storyPoints(doc.data, digest).find((p) => p.id === body.point);
  if (!point) return apiError('INVALID_INPUT', 'Choose a point from your CV.', rid);
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : '';
  const { provider } = getAiProvider();
  if (!provider) return apiError('AI_UNAVAILABLE', 'AI help is switched off right now.', rid);
  const gate = await reserve(user, 'ai.action', cfg.aiWeights.storyDraft);
  if (!gate.decision.ok)
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });
  if (!sharedAiLimiter()(`story:${user.uid}`).ok || (await aiBudgetSpent())) {
    await gate.release();
    return apiError('RATE_LIMITED', 'Too many drafts. Please wait a little.', rid);
  }
  const r = await runTask(
    'story.draft',
    {
      profile: digest.text.slice(0, 24_000),
      point: point.text,
      role: point.role,
      notes,
      skills: digest.skills.slice(0, 60),
    },
    0,
    { provider, models: aiModels(), timeoutMs: 45_000 },
  );
  await track(r.ok ? 'ai_ok' : 'ai_fail');
  if (!r.ok) {
    await gate.release();
    return apiError(
      'AI_UNAVAILABLE',
      'The story couldn’t be drafted just now. Please try again.',
      rid,
    );
  }
  return NextResponse.json(
    {
      draft: {
        ...r.result,
        source: { kind: 'cv', ref: `${point.id} · ${point.role}`.slice(0, 160) },
      },
    },
    noStore,
  );
}
