import { NextResponse } from 'next/server';
import { apiError, clientKey, readJson, requestId } from '@/lib/http';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { denialCode, includes } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { aiBudgetSpent, track } from '@/modules/metrics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const limiter = sharedAiLimiter();

/**
 * POST { input: { instruction, current }, attempt? } → design.refine: a patch of named fields
 * against the current design ("make the sidebar narrower"). Not counted on its own; needs a plan
 * that includes the AI Designer. The browser applies the patch; only the named fields change.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const { provider } = getAiProvider();
  if (!provider)
    return apiError('AI_UNAVAILABLE', 'AI help is switched off on this site.', rid, {
      reason: 'off',
    });
  if (await aiBudgetSpent())
    return apiError(
      'RATE_LIMITED',
      'AI help is resting for today. You can still adjust the design yourself.',
      rid,
      { reason: 'budget' },
    );
  const limit = limiter(`${clientKey(req)}|${(req.headers.get('x-device-id') ?? '').slice(0, 64)}`);
  if (!limit.ok)
    return apiError(
      'RATE_LIMITED',
      'You have used AI help a lot in the last few minutes. Please wait a little and try again.',
      rid,
      { reason: limit.reason },
      { 'Retry-After': String(limit.retryAfterSec) },
    );
  const body = await readJson(req, 32 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const { input, attempt } = (body.value ?? {}) as { input?: unknown; attempt?: unknown };

  const allowed = await includes(await currentUser(), 'design.ai');
  if (!allowed.ok)
    return apiError(denialCode(allowed), allowed.message, rid, { reason: allowed.reason });

  const started = Date.now();
  const r = await runTask(
    'design.refine',
    input,
    Math.max(0, Math.min(3, Math.floor(Number(attempt) || 0))),
    { provider, models: aiModels() },
  );
  console.log(
    JSON.stringify({
      event: 'ai_task',
      task: 'design.refine',
      rid,
      ok: r.ok,
      ms: Date.now() - started,
      ...(r.ok ? { model: r.model, tokens: r.usage } : { code: r.code, reason: r.reason }),
    }),
  );
  if (!r.ok) {
    await track('design_refine_fail');
    return apiError(
      r.code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'AI_UNAVAILABLE',
      r.code === 'INVALID_INPUT'
        ? 'Please describe the change in a few words.'
        : 'The AI Designer couldn’t answer just now. Please try again in a moment.',
      rid,
      { reason: r.reason },
    );
  }
  await track('design_refine');
  return NextResponse.json({ result: r.result, version: r.version });
}
