import { safeParseResumeDocument } from '@/modules/resume/schema';
import { pdfFilename } from '@/modules/export/filename';
import { buildDocx } from '@/modules/export/docx';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';
import { denialCode, reserve } from '@/modules/billing/server';
import { track } from '@/modules/metrics/server';
import { currentUser } from '@/modules/identity/session';

export const runtime = 'nodejs';
export const maxDuration = 20;

const PER_MINUTE = Number(process.env.RATE_LIMIT_PDF_PER_MINUTE ?? 10);
const limiter = createRateLimiter({ capacity: PER_MINUTE * 2, refillPerMinute: PER_MINUTE });

/**
 * POST { document } → the CV as an editable Word file. It counts as one download from the same
 * monthly allowance as PDFs. Word keeps the content and accent, not the design's layout, so any
 * design may be exported.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const rate = limiter(clientKey(req));
  if (!rate.ok)
    return apiError(
      'RATE_LIMITED',
      'Too many downloads in a short time. Please wait a moment.',
      rid,
      undefined,
      {
        'Retry-After': String(rate.retryAfterSec),
      },
    );
  const body = await readJson(req, 512 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const parsed = safeParseResumeDocument((body.value as { document?: unknown })?.document);
  if (!parsed.success) return apiError('INVALID_INPUT', 'This CV could not be read.', rid);

  const user = await currentUser();
  const gate = await reserve(user, 'pdf.download');
  if (!gate.decision.ok) {
    if (gate.decision.reason === 'sign_in') await track('pdf_denied_signin');
    if (gate.decision.reason === 'limit') await track('pdf_denied_limit');
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });
  }
  try {
    const file = await buildDocx(parsed.data);
    await track('docx_ok');
    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${pdfFilename(parsed.data.basics.name).replace(/\.pdf$/, '.docx')}"`,
        'Cache-Control': 'no-store',
        'x-request-id': rid,
      },
    });
  } catch (err) {
    await gate.release();
    console.error(
      JSON.stringify({ level: 'error', route: 'docx', rid, message: (err as Error).message }),
    );
    return apiError('RENDER_FAILED', 'We couldn’t create the Word file just now.', rid);
  }
}
