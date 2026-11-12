import { apiError, readJson, requestId } from '@/lib/http';
import { denialCode, reserve } from '@/modules/billing/server';
import { getBrowser, readFontBase64 } from '@/modules/export/pdf';
import { renderPdfFromHtml } from '@/modules/export/render';
import { currentUser } from '@/modules/identity/session';
import { buildLetterHtml } from '@/modules/letters/build-letter';
import { track } from '@/modules/metrics/server';
import { resumeDocument } from '@/modules/resume/schema';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST { document } → the job's letter as a PDF in that CV's design. Counts as a PDF download. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { id } = await ctx.params;
  const job = /^[\w-]{1,64}$/.test(id) ? await getUserStore().getJob(user.uid, id) : null;
  if (!job?.letter?.paragraphs.some((p) => p.trim()))
    return apiError('NOT_FOUND', 'Write the letter first.', rid);
  const raw = await readJson(req, 256 * 1024);
  const doc = raw.ok
    ? resumeDocument.safeParse((raw.value as { document?: unknown })?.document)
    : null;
  if (!doc?.success) return apiError('INVALID_INPUT', 'Choose the CV whose design to use.', rid);
  const gate = await reserve(user, 'pdf.download');
  if (!gate.decision.ok)
    return apiError(denialCode(gate.decision), gate.decision.message, rid, {
      reason: gate.decision.reason,
    });
  try {
    const html = buildLetterHtml(doc.data, job.letter, job, {
      fonts: { kind: 'inline', read: readFontBase64 },
    });
    const { pdf } = await renderPdfFromHtml(await getBrowser(), html);
    track('pdf_ok');
    const name = (doc.data.basics.name || 'Cover')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '');
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}-Cover-Letter.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    await gate.release();
    console.error(
      JSON.stringify({ level: 'error', route: 'letter pdf', rid, message: (e as Error).message }),
    );
    return apiError('RENDER_FAILED', 'We couldn’t create the PDF just now.', rid);
  }
}
