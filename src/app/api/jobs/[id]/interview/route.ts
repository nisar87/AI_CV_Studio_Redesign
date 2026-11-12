import { NextResponse } from 'next/server';
import { apiError } from '@/lib/http';
import { runTask } from '@/modules/ai/run';
import { prepareJobAi } from '@/modules/jobs/ai-route';
import { profileDigest } from '@/modules/jobs/digest';
import { checkInterview } from '@/modules/jobs/interview';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/** POST { document } → job with fresh interview preparation (notes from the person's CV). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await prepareJobAi(req, ctx);
  if ('error' in p) return p.error;
  const digest = profileDigest(p.doc);
  const r = await runTask(
    'interview.prep',
    {
      advert: p.job.advert.slice(0, 12_000),
      jobTitle: p.job.title,
      company: p.job.company,
      profile: digest.text.slice(0, 24_000),
    },
    0,
    p.deps,
  );
  await p.done(r.ok);
  if (!r.ok)
    return apiError(
      'AI_UNAVAILABLE',
      'We couldn’t prepare questions just now. Please try again.',
      p.rid,
    );
  const interview = checkInterview(r.result, digest, { sourceTitle: p.doc.title });
  // New questions: earlier notes no longer line up, so they are cleared.
  const job = { ...p.job, interview, interviewNotes: [], updatedAt: new Date().toISOString() };
  await getUserStore().putJob(p.user.uid, job);
  return NextResponse.json(
    { job, findings: r.findings.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
