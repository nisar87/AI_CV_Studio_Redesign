import { NextResponse } from 'next/server';
import { apiError, clientKey, readJson, requestId } from '@/lib/http';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { denialCode, reserve } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { sniff } from '@/modules/import/extract';
import { aiBudgetSpent, track } from '@/modules/metrics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** A reference picture: a screenshot or photo of a CV the person likes (base64, up to 4 MB). */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const limiter = sharedAiLimiter();

/**
 * POST { input, image?: { data }, attempt? } → design.compose (complete-studio-spec §7.4):
 * three candidate designs as flat choices. One `design.ai` use is counted on success
 * (free: one to try; Premium: 40 a month). Logs never contain the description or the picture.
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

  const body = await readJson(req, Math.ceil(MAX_IMAGE_BYTES * 1.4) + 64 * 1024);
  if (!body.ok)
    return apiError(
      body.code,
      body.code === 'PAYLOAD_TOO_LARGE'
        ? 'That picture is too large. Please use one under 4 MB.'
        : 'Invalid request.',
      rid,
    );
  const { input, image, attempt } = (body.value ?? {}) as {
    input?: Record<string, unknown>;
    image?: { data?: unknown };
    attempt?: unknown;
  };
  let files: { mimeType: string; data: string }[] | undefined;
  if (image && typeof image.data === 'string') {
    const bytes = Buffer.from(image.data, 'base64');
    const kind = sniff(new Uint8Array(bytes.subarray(0, 16)));
    if (!kind || kind.kind !== 'image' || bytes.byteLength > MAX_IMAGE_BYTES)
      return apiError(
        'INVALID_INPUT',
        'Please use a JPG, PNG, WebP or HEIC picture under 4 MB.',
        rid,
      );
    files = [{ mimeType: kind.mime, data: image.data }];
  }
  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if (!files && description.length < 2)
    return apiError('INVALID_INPUT', 'Describe the design you imagine, or add a picture.', rid);

  const gate = await reserve(await currentUser(), 'design.ai');
  if (!gate.decision.ok)
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });

  const started = Date.now();
  const r = await runTask(
    'design.compose',
    { ...input, hasImage: !!files },
    Math.max(0, Math.min(3, Math.floor(Number(attempt) || 0))),
    { provider, models: aiModels(), ...(files ? { files } : {}), timeoutMs: 45_000 },
  );
  console.log(
    JSON.stringify({
      event: 'ai_task',
      task: 'design.compose',
      rid,
      ok: r.ok,
      ms: Date.now() - started,
      image: !!files,
      ...(r.ok ? { model: r.model, tokens: r.usage } : { code: r.code, reason: r.reason }),
    }),
  );
  if (!r.ok) {
    await gate.release();
    await track('design_compose_fail');
    return apiError(
      r.code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'AI_UNAVAILABLE',
      r.code === 'INVALID_INPUT'
        ? 'Something in the request was not valid.'
        : 'The AI Designer couldn’t answer just now. Please try again in a moment.',
      rid,
      { reason: r.reason },
    );
  }
  await track('design_compose');
  return NextResponse.json({ result: r.result, version: r.version });
}
