import 'server-only';
import { apiError, readJson, requestId } from '@/lib/http';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { aiBudgetSpent } from '@/modules/metrics/server';
import { denialCode, reserve } from '@/modules/billing/server';
import { currentUser, type SessionUser } from '@/modules/identity/session';
import { track } from '@/modules/metrics/server';
import { resumeDocument, type ResumeDocument } from '@/modules/resume/schema';
import { getUserStore } from '@/modules/store';
import type { Job } from './schema';

/**
 * Shared steps for the job AI routes (match, tailor, letter): signed in, own job with an advert,
 * a valid CV in the body, the Premium AI allowance (released if the AI fails), the shared budget.
 */
export async function prepareJobAi(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
  /** AI actions this request costs (the application kit = 3, spec §14). */
  weight = 1,
): Promise<
  | { error: Response }
  | {
      rid: string;
      user: SessionUser;
      job: Job;
      doc: ResumeDocument;
      body: Record<string, unknown>;
      deps: Parameters<typeof import('@/modules/ai/run').runTask>[3];
      done: (ok: boolean) => Promise<void>;
    }
> {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return { error: apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid) };
  const { id } = await ctx.params;
  const job = /^[\w-]{1,64}$/.test(id) ? await getUserStore().getJob(user.uid, id) : null;
  if (!job) return { error: apiError('NOT_FOUND', 'Job not found.', rid) };
  if (job.advert.trim().length < 80)
    return {
      error: apiError(
        'INVALID_INPUT',
        'Paste the job advert first (at least a few sentences).',
        rid,
      ),
    };
  const raw = await readJson(req, 256 * 1024);
  if (!raw.ok) return { error: apiError(raw.code, 'Invalid request.', rid) };
  const body = (raw.value ?? {}) as Record<string, unknown>;
  const parsed = resumeDocument.safeParse(body.document);
  if (!parsed.success) return { error: apiError('INVALID_INPUT', 'Choose a CV to use.', rid) };
  const { provider } = getAiProvider();
  if (!provider)
    return { error: apiError('AI_UNAVAILABLE', 'AI help is switched off right now.', rid) };
  const gate = await reserve(user, 'ai.action', weight);
  if (!gate.decision.ok)
    return {
      error: apiError(denialCode(gate.decision), gate.decision.message, rid, {
        reason: gate.decision.reason,
      }),
    };
  const limit = sharedAiLimiter()(`job:${user.uid}`);
  if (!limit.ok || (await aiBudgetSpent())) {
    await gate.release();
    return { error: apiError('RATE_LIMITED', 'Too many AI requests. Please wait a little.', rid) };
  }
  return {
    rid,
    user,
    job,
    doc: parsed.data,
    body,
    deps: { provider, models: aiModels(), timeoutMs: 60_000 },
    done: async (ok) => {
      await track(ok ? 'ai_ok' : 'ai_fail');
      if (!ok) await gate.release();
    },
  };
}
