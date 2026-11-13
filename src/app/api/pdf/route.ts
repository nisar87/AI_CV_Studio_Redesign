import { safeParseResumeDocument } from '@/modules/resume/schema';
import { pdfFilename } from '@/modules/export/filename';
import { renderResumePdf } from '@/modules/export/pdf';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';
import { checkDesign, denialCode, reserve } from '@/modules/billing/server';
import { track } from '@/modules/metrics/server';
import { currentUser } from '@/modules/identity/session';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BODY = 512 * 1024;
const PER_MINUTE = Number(process.env.RATE_LIMIT_PDF_PER_MINUTE ?? 10);
const limiter = createRateLimiter({ capacity: PER_MINUTE * 2, refillPerMinute: PER_MINUTE });
let inFlight = 0;
const MAX_CONCURRENT = 4;

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

  const body = await readJson(req, MAX_BODY);
  if (!body.ok)
    return apiError(
      body.code,
      body.code === 'PAYLOAD_TOO_LARGE' ? 'This CV is too large to export.' : 'Invalid request.',
      rid,
    );

  const parsed = safeParseResumeDocument((body.value as { document?: unknown })?.document);
  if (!parsed.success)
    return apiError('INVALID_INPUT', 'This CV could not be read.', rid, {
      issues: parsed.error.issues.slice(0, 10),
    });

  // Entitlement gate: design tier, then the monthly download allowance (counted on success only).
  const user = await currentUser();
  const design = await checkDesign(user, parsed.data.design);
  if (!design.ok) {
    await track(design.reason === 'sign_in' ? 'pdf_denied_signin' : 'pdf_denied_premium');
    return apiError(denialCode(design), design.message, rid, { reason: design.reason });
  }
  const gate = await reserve(user, 'pdf.download');
  if (!gate.decision.ok) {
    if (gate.decision.reason === 'sign_in') await track('pdf_denied_signin');
    if (gate.decision.reason === 'limit') await track('pdf_denied_limit');
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
      ...('limit' in gate.decision ? { limit: gate.decision.limit, used: gate.decision.used } : {}),
    });
  }

  if (inFlight >= MAX_CONCURRENT) {
    await gate.release();
    return apiError(
      'RATE_LIMITED',
      'We are busy creating other PDFs. Please try again in a few seconds.',
      rid,
      undefined,
      { 'Retry-After': '3' },
    );
  }

  inFlight++;
  try {
    const { pdf, pages } = await renderResumePdf(parsed.data);
    await track('pdf_ok');
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename(parsed.data.basics.name)}"`,
        'Cache-Control': 'no-store',
        'x-page-count': String(pages),
        'x-request-id': rid,
      },
    });
  } catch (err) {
    await gate.release();
    console.error(
      JSON.stringify({ level: 'error', route: '/api/pdf', rid, message: (err as Error).message }),
    );
    return apiError('RENDER_FAILED', 'We couldn’t create the PDF just now.', rid);
  } finally {
    inFlight--;
  }
}
