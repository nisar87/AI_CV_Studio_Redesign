import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { denialCode, getBusinessConfig, reserve } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { extractLines, ImportError, MAX_IMPORT_BYTES, sniff } from '@/modules/import/extract';
import { profileDigest } from '@/modules/jobs/digest';
import { exportFacts, factsLines, looksLikeLinkedin } from '@/modules/linkedin/review';
import { aiBudgetSpent, track } from '@/modules/metrics/server';
import { safeParseResumeDocument } from '@/modules/resume/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NOT_LINKEDIN =
  'This doesn’t look like a LinkedIn profile saved as a PDF. On LinkedIn, open your profile, press “More” (or “Resources”), then “Save to PDF”, and upload that file.';

/**
 * POST (multipart: file = the LinkedIn "Save to PDF" export; document = a CV to compare with,
 * optional; target = the role they want, optional) → { review }. One AI action (Premium). The
 * file is read in memory and never stored; nothing is kept on the server.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.linkedinReview)
    return apiError('DISABLED', 'The LinkedIn review is switched off right now.', rid, {
      reason: 'disabled',
    });
  if (Number(req.headers.get('content-length') ?? 0) > MAX_IMPORT_BYTES + 600 * 1024)
    return apiError('PAYLOAD_TOO_LARGE', 'That file is larger than 10 MB.', rid);

  let lines: string[];
  let profile = '';
  let target = '';
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File))
      return apiError('INVALID_INPUT', 'Choose the PDF you saved from LinkedIn.', rid);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (sniff(bytes)?.kind !== 'pdf')
      return apiError('UNPROCESSABLE', 'Please upload the PDF you saved from LinkedIn.', rid);
    const doc = form.get('document');
    if (typeof doc === 'string' && doc) {
      const parsed = safeParseResumeDocument(JSON.parse(doc));
      if (!parsed.success) return apiError('INVALID_INPUT', 'Choose a CV to compare with.', rid);
      profile = profileDigest(parsed.data).text.slice(0, 24_000);
    }
    const t = form.get('target');
    target = typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    const read = await extractLines(bytes);
    if (read.scanned)
      return apiError(
        'UNPROCESSABLE',
        'We couldn’t read any text in this PDF. Save your profile from LinkedIn again with “Save to PDF” and upload that file.',
        rid,
      );
    lines = read.lines;
  } catch (e) {
    if (e instanceof ImportError) return apiError('UNPROCESSABLE', e.message, rid);
    if (e instanceof SyntaxError) return apiError('INVALID_INPUT', 'Invalid request.', rid);
    return apiError('UNPROCESSABLE', 'We couldn’t open that file. Please try again.', rid);
  }
  // Checked before any AI is used, so a wrong file costs nothing.
  if (!looksLikeLinkedin(lines)) return apiError('UNPROCESSABLE', NOT_LINKEDIN, rid);

  const { provider } = getAiProvider();
  if (!provider) return apiError('AI_UNAVAILABLE', 'AI help is switched off right now.', rid);
  const gate = await reserve(user, 'ai.action', cfg.aiWeights.linkedinReview);
  if (!gate.decision.ok)
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });
  if (!sharedAiLimiter()(`linkedin-review:${user.uid}`).ok || (await aiBudgetSpent())) {
    await gate.release();
    return apiError('RATE_LIMITED', 'Too many requests. Please wait a little.', rid);
  }
  const facts = exportFacts(lines);
  const r = await runTask(
    'linkedin.review',
    { export: lines.join('\n').slice(0, 20_000), facts: factsLines(facts), profile, target },
    0,
    { provider, models: aiModels(), timeoutMs: 50_000 },
  );
  await track(r.ok ? 'ai_ok' : 'ai_fail');
  if (!r.ok || !r.result.isLinkedin || !r.result.sections.length) {
    await gate.release();
    await track('linkedin_review_fail');
    return r.ok && !r.result.isLinkedin
      ? apiError('UNPROCESSABLE', NOT_LINKEDIN, rid)
      : apiError('AI_UNAVAILABLE', 'The review couldn’t be made just now. Please try again.', rid);
  }
  await track('linkedin_review');
  return NextResponse.json(
    {
      review: {
        overall: r.result.overall,
        sections: r.result.sections,
        compared: !!profile,
        createdAt: new Date().toISOString(),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
