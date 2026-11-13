import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { getBusinessConfig } from '@/modules/billing/server';
import { runTask } from '@/modules/ai/run';
import { prepareJobAi } from '@/modules/jobs/ai-route';
import { profileDigest } from '@/modules/jobs/digest';
import { applyTailor } from '@/modules/jobs/match';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST { document, tone } → { document, job } — the application kit in one call (spec §10): a CV
 * tailored to the job, a cover letter and a covering email. The tailored CV is returned for the
 * browser to save like any CV (so it syncs); the letter and email are saved on the job.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // The kit costs several AI actions (tailored CV, letter, email): Console → AI weights (spec §14).
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.kit)
    return apiError('DISABLED', 'The application kit is switched off right now.', requestId(), {
      reason: 'disabled',
    });
  const p = await prepareJobAi(req, ctx, cfg.aiWeights.kit);
  if ('error' in p) return p.error;
  const tone = p.body.tone === 'formal' ? 'formal' : 'warm';
  const digest = profileDigest(p.doc);
  const job = {
    advert: p.job.advert.slice(0, 12_000),
    jobTitle: p.job.title,
    company: p.job.company,
  };
  const profile = digest.text.slice(0, 24_000);
  const [tailor, letter] = await Promise.all([
    runTask('job.tailor', { ...job, profile }, 0, p.deps),
    runTask('letter.write', { ...job, name: p.doc.basics.name, profile, tone }, 0, p.deps),
  ]);
  const ok = tailor.ok && letter.ok;
  await p.done(ok);
  if (!tailor.ok || !letter.ok)
    return apiError(
      'AI_UNAVAILABLE',
      'We couldn’t make your kit just now. Nothing was counted — please try again.',
      p.rid,
    );
  const document = applyTailor(p.doc, tailor.result, digest, p.job);
  const now = new Date().toISOString();
  const next = {
    ...p.job,
    letter: { ...letter.result, tone, documentId: document.id, updatedAt: now },
    documentIds: [...p.job.documentIds.filter((x) => x !== document.id), document.id].slice(-10),
    kit: { cvId: document.id, at: now },
    updatedAt: now,
  } as typeof p.job;
  await getUserStore().putJob(p.user.uid, next);
  return NextResponse.json(
    { document, job: next, findings: tailor.findings.length + letter.findings.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
