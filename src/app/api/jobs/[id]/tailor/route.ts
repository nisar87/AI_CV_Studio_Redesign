import { NextResponse } from 'next/server';
import { apiError } from '@/lib/http';
import { runTask } from '@/modules/ai/run';
import { prepareJobAi } from '@/modules/jobs/ai-route';
import { profileDigest } from '@/modules/jobs/digest';
import { applyTailor } from '@/modules/jobs/match';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST { document } → { document: tailored copy } (not saved here: the browser saves it like any
 * CV, so it syncs). Only the order of the person's own facts and a guarded summary change.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await prepareJobAi(req, ctx);
  if ('error' in p) return p.error;
  const digest = profileDigest(p.doc);
  const r = await runTask(
    'job.tailor',
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
      'We couldn’t tailor your CV just now. Please try again.',
      p.rid,
    );
  const document = applyTailor(p.doc, r.result, digest, p.job);
  return NextResponse.json(
    { document, findings: r.findings.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
