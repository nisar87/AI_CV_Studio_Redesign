import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { isTaskId, type AiResponse, type TaskId } from '@/modules/ai/schemas';
import { apiError, clientKey, readJson, requestId } from '@/lib/http';
import { denialCode, reserve } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY = 48 * 1024;
const limiter = sharedAiLimiter();

/** POST /api/ai/:task — docs/engineering/api-contracts.md. Logs never contain user text. */
export async function POST(req: Request, ctx: { params: Promise<{ task: string }> }) {
  const rid = requestId();
  const { task } = await ctx.params;
  // import.structure is internal (used by /api/import with its own checks), not a public task.
  if (!isTaskId(task) || task === 'import.structure')
    return apiError('INVALID_INPUT', 'Unknown AI task.', rid);

  const { mode, provider } = getAiProvider();
  if (!provider)
    return apiError('AI_UNAVAILABLE', 'AI help is switched off on this site.', rid, {
      reason: 'off',
    });

  const device = (req.headers.get('x-device-id') ?? '').slice(0, 64);
  const key = `${clientKey(req)}|${device}`;
  const limit = limiter(key);
  if (!limit.ok)
    return apiError(
      'RATE_LIMITED',
      limit.reason === 'burst'
        ? 'You have used AI help a lot in the last few minutes. Please wait a little and try again.'
        : 'You have reached today’s limit for AI help. You can keep writing yourself, and AI help will be back tomorrow.',
      rid,
      { reason: limit.reason },
      { 'Retry-After': String(limit.retryAfterSec) },
    );

  const body = await readJson(req, MAX_BODY);
  if (!body.ok)
    return apiError(
      body.code,
      body.code === 'PAYLOAD_TOO_LARGE'
        ? 'That is too much text for AI help at once.'
        : 'Invalid request.',
      rid,
    );
  const { input, attempt } = (body.value ?? {}) as { input?: unknown; attempt?: unknown };
  const tries = Math.max(0, Math.min(5, Math.floor(Number(attempt) || 0)));

  // Entitlement gate: AI actions are part of Premium (monthly allowance, counted on success only).
  const gate = await reserve(await currentUser(), 'ai.action');
  if (!gate.decision.ok)
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });

  const started = Date.now();
  const r = await runTask(task as TaskId, input, tries, {
    provider,
    models: aiModels(),
  });
  console.log(
    JSON.stringify({
      level: r.ok ? 'info' : 'warn',
      route: '/api/ai',
      rid,
      task,
      provider: mode,
      ms: Date.now() - started,
      ...(r.ok
        ? { version: r.version, model: r.model, usage: r.usage, flagged: r.findings.length }
        : { code: r.code, reason: r.reason }),
    }),
  );

  if (!r.ok) {
    await gate.release();
    if (r.code === 'INVALID_INPUT')
      return apiError('INVALID_INPUT', 'Some details could not be read.', rid, {
        issues: r.issues,
      });
    if (r.code === 'AI_INVALID_OUTPUT')
      return apiError(
        'AI_INVALID_OUTPUT',
        'AI help gave an answer we could not use. Please try again.',
        rid,
      );
    return apiError(
      'AI_UNAVAILABLE',
      r.reason === 'timeout'
        ? 'AI help is taking too long right now. Please try again, or keep writing yourself.'
        : 'AI help is not available right now. You can keep writing yourself.',
      rid,
      { reason: r.reason },
    );
  }

  const res: AiResponse<TaskId> = {
    task: task as TaskId,
    version: r.version,
    provider: mode === 'gemini' ? 'gemini' : 'mock',
    result: r.result,
    needsInput: r.needsInput,
    usage: { remainingToday: limit.remainingToday },
  };
  return Response.json(res, { headers: { 'Cache-Control': 'no-store', 'x-request-id': rid } });
}
