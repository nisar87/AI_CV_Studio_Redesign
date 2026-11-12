import { NextResponse } from 'next/server';
import { apiError } from '@/lib/http';
import { runTask } from '@/modules/ai/run';
import { prepareJobAi } from '@/modules/jobs/ai-route';
import { profileDigest } from '@/modules/jobs/digest';
import { checkMatch } from '@/modules/jobs/match';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/** POST { document } → job with a fresh `match` (CV vs advert, evidence checked against the CV). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await prepareJobAi(req, ctx);
  if ('error' in p) return p.error;
  const digest = profileDigest(p.doc);
  const r = await runTask(
    'job.match',
    { advert: p.job.advert.slice(0, 12_000), profile: digest.text.slice(0, 24_000) },
    0,
    p.deps,
  );
  await p.done(r.ok);
  if (!r.ok)
    return apiError('AI_UNAVAILABLE', 'We couldn’t check this just now. Please try again.', p.rid);
  const match = checkMatch(r.result, digest, { sourceTitle: p.doc.title });
  const job = { ...p.job, match, updatedAt: new Date().toISOString() };
  await getUserStore().putJob(p.user.uid, job);
  return NextResponse.json({ job }, { headers: { 'Cache-Control': 'no-store' } });
}
