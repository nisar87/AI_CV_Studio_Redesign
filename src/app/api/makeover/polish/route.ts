import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, clientKey, readJson, requestId } from '@/lib/http';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { taskInputs } from '@/modules/ai/schemas';
import { denialCode, getBusinessConfig, reserve } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { giveBackFreeWording, makeoverRecord, takeFreeWording } from '@/modules/makeover/server';
import { aiBudgetSpent, track } from '@/modules/metrics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const limiter = sharedAiLimiter();
const body = z.object({
  makeoverId: z.string().max(64),
  input: taskInputs['makeover.diagnose'],
});

/**
 * POST { makeoverId, input } → { items } — suggestions for one polish chip (spec §6.4).
 * "Fix wording" is free once per makeover; otherwise each call is one AI action (Premium).
 * Every suggestion has passed the truth guard; one with an unsupported fact is never returned.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const { value: cfg } = await getBusinessConfig();
  const { provider } = getAiProvider();
  if (!provider || !cfg.features.ai)
    return apiError('AI_UNAVAILABLE', 'AI help is switched off right now.', rid, { reason: 'off' });
  if (await aiBudgetSpent())
    return apiError(
      'RATE_LIMITED',
      'AI help is resting for today. Please try again tomorrow.',
      rid,
      {
        reason: 'budget',
      },
    );
  const limit = limiter(`polish:${clientKey(req)}`);
  if (!limit.ok)
    return apiError('RATE_LIMITED', 'Please wait a little and try again.', rid, {
      reason: limit.reason,
    });

  const raw = await readJson(req, 64 * 1024);
  if (!raw.ok) return apiError(raw.code, 'Invalid request.', rid);
  const parsed = body.safeParse(raw.value);
  if (!parsed.success) return apiError('INVALID_INPUT', 'Invalid request.', rid);
  const { makeoverId, input } = parsed.data;
  if (!(await makeoverRecord(makeoverId)))
    return apiError('NOT_FOUND', 'This makeover has expired. Please upload again.', rid);

  let release: () => Promise<void>;
  if (input.chip === 'wording' && (await takeFreeWording(makeoverId))) {
    release = () => giveBackFreeWording(makeoverId);
  } else {
    const gate = await reserve(await currentUser(), 'ai.action');
    if (!gate.decision.ok)
      return apiError(denialCode(gate.decision), gate.decision.message, rid, {
        reason: gate.decision.reason,
      });
    release = gate.release;
  }

  const r = await runTask('makeover.diagnose', input, 0, {
    provider,
    models: aiModels(),
    timeoutMs: 45_000,
  });
  await track(r.ok ? 'polish_ok' : 'polish_fail');
  if (!r.ok) {
    await release();
    return apiError(
      r.code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'AI_UNAVAILABLE',
      'AI help isn’t available right now. Please try again in a moment.',
      rid,
      { reason: r.reason },
    );
  }
  console.log(
    JSON.stringify({
      level: 'info',
      route: '/api/makeover/polish',
      rid,
      chip: input.chip,
      lines: input.items.length,
      suggestions: r.result.items.length,
    }),
  );
  return NextResponse.json({ items: r.result.items }, { headers: { 'Cache-Control': 'no-store' } });
}
