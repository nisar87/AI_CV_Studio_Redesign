import { NextResponse } from 'next/server';
import { apiError, clientKey, createRateLimiter, requestId } from '@/lib/http';
import { denialCode, getBusinessConfig, reserve } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { ImportError, MAX_IMPORT_BYTES, TOO_LARGE_MESSAGE } from '@/modules/import/extract';
import { readCv } from '@/modules/import/pipeline';
import { track } from '@/modules/metrics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Uploads per minute per IP (burst = 2x). Configurable for e2e.
const PER_MINUTE = Number(process.env.RATE_LIMIT_IMPORT_PER_MINUTE ?? 5);
const limiter = createRateLimiter({ capacity: PER_MINUTE * 2, refillPerMinute: PER_MINUTE });

/**
 * POST multipart { file, locale? } → { document, report }. The file is read in memory and
 * discarded; nothing is stored here (the browser saves the new CV, which then syncs).
 * Counts one "import.cv" use, only when the import succeeds.
 */
export async function POST(req: Request) {
  const rid = requestId();
  if (!limiter(clientKey(req)).ok)
    return apiError('RATE_LIMITED', 'Too many uploads. Please wait a minute.', rid);
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_IMPORT_BYTES + 64 * 1024)
    return apiError('INVALID_INPUT', TOO_LARGE_MESSAGE, rid);

  const user = await currentUser();
  const gate = await reserve(user, 'import.cv');
  if (!gate.decision.ok)
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      await gate.release();
      return apiError('INVALID_INPUT', 'Please choose a file to import.', rid);
    }
    const localeRaw = String(form.get('locale') ?? '');
    const locale = /^[a-z]{2}-[A-Z]{2}$/.test(localeRaw) ? localeRaw : 'en-GB';
    const bytes = new Uint8Array(await file.arrayBuffer());
    const features = (await getBusinessConfig()).value.features;
    // Gemini sorts the CV when available (verified copy-only); the rules are the fallback.
    const read = await readCv(bytes, { key: user?.uid ?? clientKey(req), locale, ai: features.ai });
    const { doc, report, method, kind, lines } = read;
    await track('import_ok');
    await track(method === 'ai' ? 'import_ai' : 'import_rules');
    console.log(
      JSON.stringify({
        level: 'info',
        route: '/api/import',
        rid,
        kind,
        lines: lines.length,
        method,
        scanned: read.scanned,
        coverage: Math.round(read.coverage.ratio * 1000) / 10,
        sections: report.sections.length,
        unplaced: report.unplaced,
      }),
    );
    return NextResponse.json(
      { document: doc, report, method, scanned: read.scanned },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    await gate.release();
    await track('import_fail');
    if (e instanceof ImportError)
      return apiError('INVALID_INPUT', e.message, rid, { reason: e.code });
    console.error(
      JSON.stringify({ level: 'error', route: '/api/import', rid, message: (e as Error).message }),
    );
    return apiError(
      'INTERNAL',
      'We couldn’t read that file. Please try again or use a different file.',
      rid,
    );
  }
}
