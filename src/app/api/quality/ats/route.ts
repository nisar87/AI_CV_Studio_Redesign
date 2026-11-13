import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { denialCode, reserve } from '@/modules/billing/server';
import { renderResumePdf } from '@/modules/export/pdf';
import { currentUser } from '@/modules/identity/session';
import { extractLines } from '@/modules/import/extract';
import { profileDigest } from '@/modules/jobs/digest';
import { aiBudgetSpent, track } from '@/modules/metrics/server';
import { assessReadBack, checkKeywords, type AtsReport } from '@/modules/quality/ats';
import { safeParseResumeDocument } from '@/modules/resume/schema';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST { document, jobId? } → AtsReport. Renders the CV exactly as it would download, reads the PDF
 * back with our importer and reports per check. With Premium and a saved job's advert, also which
 * of the advert's terms the CV uses (AI lists the terms; presence is checked here).
 */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  const raw = await readJson(req, 512 * 1024);
  if (!raw.ok) return apiError(raw.code, 'Invalid request.', rid);
  const body = (raw.value ?? {}) as { document?: unknown; jobId?: unknown };
  const parsed = safeParseResumeDocument(body.document);
  if (!parsed.success) return apiError('INVALID_INPUT', 'This CV couldn’t be read.', rid);
  const doc = parsed.data;
  const gate = await reserve(user, 'ats.check');
  if (!gate.decision.ok)
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });
  let report: AtsReport;
  try {
    const { pdf, pages } = await renderResumePdf(doc);
    const { lines } = await extractLines(new Uint8Array(pdf));
    report = {
      at: new Date().toISOString(),
      checks: assessReadBack(doc, lines, { pages }),
      sample: lines.slice(0, 12),
    };
  } catch (e) {
    await gate.release();
    console.error(
      JSON.stringify({ level: 'error', route: 'ats', rid, message: (e as Error).message }),
    );
    return apiError('RENDER_FAILED', 'We couldn’t check this CV just now. Please try again.', rid);
  }
  await track('ats_check');

  // Keywords: Premium only, against one of the person's saved jobs.
  const jobId = typeof body.jobId === 'string' ? body.jobId : '';
  if (user && gate.plan === 'premium' && /^[\w-]{1,64}$/.test(jobId)) {
    const job = await getUserStore().getJob(user.uid, jobId);
    const { provider } = getAiProvider();
    if (
      job &&
      job.advert.trim().length >= 80 &&
      provider &&
      sharedAiLimiter()(`ats:${user.uid}`).ok &&
      !(await aiBudgetSpent())
    ) {
      const digest = profileDigest(doc);
      const r = await runTask(
        'quality.atsKeywords',
        { advert: job.advert.slice(0, 12_000), profile: digest.text.slice(0, 24_000) },
        0,
        { provider, models: aiModels(), timeoutMs: 30_000 },
      );
      await track(r.ok ? 'ai_ok' : 'ai_fail');
      if (r.ok) report.keywords = checkKeywords(r.result, digest, job.title);
    }
  }
  return NextResponse.json({ report }, { headers: { 'Cache-Control': 'no-store' } });
}
