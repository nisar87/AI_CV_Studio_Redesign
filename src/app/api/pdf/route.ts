import { safeParseResumeDocument } from '@/modules/resume/schema';
import { pdfFilename } from '@/modules/export/filename';
import { renderResumePdf } from '@/modules/export/pdf';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';

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

  if (inFlight >= MAX_CONCURRENT)
    return apiError(
      'RATE_LIMITED',
      'We are busy creating other PDFs. Please try again in a few seconds.',
      rid,
      undefined,
      { 'Retry-After': '3' },
    );

  inFlight++;
  try {
    const { pdf, pages } = await renderResumePdf(parsed.data);
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
    console.error(
      JSON.stringify({ level: 'error', route: '/api/pdf', rid, message: (err as Error).message }),
    );
    return apiError('RENDER_FAILED', 'We couldn’t create the PDF just now.', rid);
  } finally {
    inFlight--;
  }
}
