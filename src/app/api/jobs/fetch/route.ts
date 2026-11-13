import { NextResponse } from 'next/server';
import { apiError, createRateLimiter, readJson, requestId } from '@/lib/http';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { getBusinessConfig } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { fetchJobPage } from '@/modules/jobs/fetch';
import { fromExtract, fromPlainPage, fromPosting, type JobFromUrl } from '@/modules/jobs/from-url';
import { PageError, readPage } from '@/modules/jobs/page';
import { jobAllowance } from '@/modules/jobs/server';
import { aiBudgetSpent, track } from '@/modules/metrics/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const noStore = { headers: { 'Cache-Control': 'no-store' } };
const g = globalThis as { __jobUrlLimiter?: ReturnType<typeof createRateLimiter> };
const limiter = (g.__jobUrlLimiter ??= createRateLimiter({ capacity: 20, refillPerMinute: 2 }));

/**
 * POST { url } → { job }: the job read from its advert page, for the person to check and save.
 * Signed in and within the plan's job limit (spec §14: not an AI action). The page is fetched
 * safely (modules/jobs/fetch.ts); its JSON-LD JobPosting is used when there is one, otherwise
 * the fast AI reads the page text as data, and every value is checked against the page.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to save jobs.', rid);
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.jobFromUrl)
    return apiError('DISABLED', 'Reading jobs from links is switched off right now.', rid, {
      reason: 'disabled',
    });
  const body = await readJson(req, 4 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const url = String((body.value as { url?: unknown } | null)?.url ?? '')
    .trim()
    .slice(0, 500);
  if (!url) return apiError('INVALID_INPUT', 'Paste the link to the job advert.', rid);

  const [{ max }, existing] = await Promise.all([
    jobAllowance(user),
    getUserStore().listJobs(user.uid),
  ]);
  if (max !== -1 && existing.length >= max)
    return apiError(
      max === 0 ? 'PREMIUM_REQUIRED' : 'LIMIT_REACHED',
      max === 0
        ? 'The job tracker isn’t included in your plan.'
        : `Your plan tracks up to ${max} jobs. Remove one you no longer need, or get Premium for more.`,
      rid,
      { reason: max === 0 ? 'premium' : 'limit', limit: max },
    );
  if (!limiter(user.uid).ok)
    return apiError('RATE_LIMITED', 'Too many links at once. Please wait a minute.', rid);

  let page;
  try {
    page = await fetchJobPage(url);
  } catch (e) {
    await track('job_url_fail');
    const msg =
      e instanceof PageError
        ? e.message
        : 'The page couldn’t be read. Paste the advert text instead.';
    return apiError(
      e instanceof PageError && e.code === 'BAD_URL' ? 'INVALID_INPUT' : 'UNPROCESSABLE',
      msg,
      rid,
      {
        reason: e instanceof PageError ? e.code.toLowerCase() : 'network',
      },
    );
  }
  const info = readPage(page.html);
  if (info.text.length < 40 && !info.posting) {
    await track('job_url_fail');
    return apiError(
      'UNPROCESSABLE',
      'That page has no advert text we can read (it may need JavaScript or a sign-in). Paste the advert text instead.',
      rid,
      { reason: 'empty' },
    );
  }

  let job: JobFromUrl | null = fromPosting(page.url, info);
  if (!job) {
    const { provider } = getAiProvider();
    const aiOk =
      provider &&
      cfg.features.ai &&
      sharedAiLimiter()(`joburl:${user.uid}`).ok &&
      !(await aiBudgetSpent());
    if (aiOk) {
      const r = await runTask(
        'jobs.extract',
        {
          url: page.url,
          pageTitle: info.title,
          siteName: info.siteName,
          text: info.text.slice(0, 14_000),
        },
        0,
        { provider, models: aiModels(), timeoutMs: 20_000 },
      );
      await track(r.ok ? 'ai_ok' : 'ai_fail');
      if (r.ok) {
        job = fromExtract(page.url, info, r.result);
        if (!job) {
          await track('job_url_fail');
          return apiError(
            'UNPROCESSABLE',
            'That page doesn’t look like one job advert. Open the job itself and copy its link, or paste the advert text.',
            rid,
            { reason: 'not_a_job' },
          );
        }
      }
    }
    job ??= fromPlainPage(page.url, info);
  }
  await track(
    job.via === 'structured'
      ? 'job_url_structured'
      : job.via === 'ai'
        ? 'job_url_ai'
        : 'job_url_page',
  );
  return NextResponse.json({ job }, noStore);
}
