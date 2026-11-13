import { NextResponse } from 'next/server';
import { apiError, clientKey, createRateLimiter, requestId } from '@/lib/http';
import { getBusinessConfig, reserve } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { ImportError, MAX_IMPORT_BYTES, TOO_LARGE_MESSAGE } from '@/modules/import/extract';
import { readCv } from '@/modules/import/pipeline';
import { chipCounts } from '@/modules/makeover/polish';
import { detectProfile } from '@/modules/makeover/profile';
import { contentStats, rankDesigns } from '@/modules/makeover/rank';
import { issueMakeover, takePreview } from '@/modules/makeover/server';
import { track } from '@/modules/metrics/server';
import { DESIGN_IDS, TEMPLATE_IDS, type DesignId } from '@/modules/resume/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PER_MINUTE = Number(process.env.RATE_LIMIT_IMPORT_PER_MINUTE ?? 5);
const limiter = createRateLimiter({ capacity: PER_MINUTE * 2, refillPerMinute: PER_MINUTE });

/**
 * Instant Makeover (spec §6). POST multipart { file, locale? } → the CV read into a document,
 * its profession, a ranked strip of designs and the polish chip counts.
 *
 * - Signed in with import allowance left → "full": one import.cv use is counted now.
 * - Visitor, or an account over its allowance → "preview" (a daily quota, watermarked in the
 *   browser). A visitor's preview is saved to the account later through /api/makeover/claim,
 *   which counts the import then.
 * The file is read in memory and discarded.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const ip = clientKey(req);
  if (!limiter(ip).ok)
    return apiError('RATE_LIMITED', 'Too many uploads. Please wait a minute.', rid);
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_IMPORT_BYTES + 64 * 1024)
    return apiError('INVALID_INPUT', TOO_LARGE_MESSAGE, rid, { reason: 'TOO_LARGE' });

  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.import)
    return apiError(
      'DISABLED',
      'Importing is switched off right now. Please try again later.',
      rid,
    );

  const user = await currentUser();
  let mode: 'full' | 'preview' = 'preview';
  let release = async () => {};
  if (user) {
    const gate = await reserve(user, 'import.cv');
    if (gate.decision.ok) {
      mode = 'full';
      release = gate.release;
    }
  }
  if (mode === 'preview') {
    const slot = await takePreview({ uid: user?.uid, ip });
    if (!slot.ok)
      return apiError(
        'LIMIT_REACHED',
        user
          ? 'You’ve used today’s preview and this month’s imports. Upgrade to Premium to import more, or come back tomorrow.'
          : 'You’ve tried a few CVs today. Sign in (it’s free) to keep going.',
        rid,
        { reason: user ? 'limit' : 'sign_in' },
      );
    release = slot.release;
  }
  await track('makeover_start');

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      await release();
      return apiError('INVALID_INPUT', 'Please choose a file.', rid);
    }
    const localeRaw = String(form.get('locale') ?? '');
    const locale = /^[a-z]{2}-[A-Z]{2}$/.test(localeRaw) ? localeRaw : 'en-GB';
    const bytes = new Uint8Array(await file.arrayBuffer());
    const t0 = Date.now();
    const read = await readCv(bytes, { key: user?.uid ?? ip, locale, ai: cfg.features.ai });
    const profile = detectProfile(read.doc);
    const doc = {
      ...read.doc,
      presetId: read.doc.presetId === 'general' ? profile.presetId : read.doc.presetId,
    };
    const enabled: DesignId[] = DESIGN_IDS.filter(
      (id) => cfg.designs.find((d) => d.id === id)?.enabled === true,
    );
    const stats = contentStats(doc, profile.presetId, read.photo);
    const ranking = rankDesigns(stats, enabled.length ? enabled : [...TEMPLATE_IDS]);
    const makeoverId = await issueMakeover(mode === 'full');

    await track('makeover_reveal');
    if (mode === 'preview') await track('makeover_preview');
    await track('import_ok');
    await track(read.method === 'ai' ? 'import_ai' : 'import_rules');
    console.log(
      JSON.stringify({
        level: 'info',
        route: '/api/makeover',
        rid,
        mode,
        kind: read.kind,
        scanned: read.scanned,
        method: read.method,
        lines: read.lines.length,
        coverage: Math.round(read.coverage.ratio * 1000) / 10,
        preset: profile.presetId,
        ms: Date.now() - t0,
      }),
    );
    return NextResponse.json(
      {
        makeoverId,
        mode,
        // Why it is a preview: a visitor (saved after sign-in) or an account over its allowance.
        previewFor: mode === 'full' ? null : user ? 'limit' : 'visitor',
        document: doc,
        report: read.report,
        method: read.method,
        kind: read.kind,
        scanned: read.scanned,
        photo: read.photo,
        // The original text: the "before" view of Word files and the unplaced-lines panel.
        lines: read.lines,
        coverage: read.coverage,
        profile,
        stats,
        ranking,
        counts: chipCounts(doc),
        ai: cfg.features.ai,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    await release();
    await track('makeover_fail');
    if (e instanceof ImportError)
      return apiError('INVALID_INPUT', e.message, rid, { reason: e.code });
    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/makeover',
        rid,
        message: (e as Error).message,
      }),
    );
    return apiError(
      'INTERNAL',
      'We couldn’t read that file. Please try again or use a different file.',
      rid,
    );
  }
}
