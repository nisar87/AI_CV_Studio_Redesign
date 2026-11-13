import { apiError, readJson } from '@/lib/http';
import { denialCode, reserve } from '@/modules/billing/server';
import { getBrowser, readFontBase64 } from '@/modules/export/pdf';
import { renderPdfFromHtml } from '@/modules/export/render';
import { buildLetterHtml } from '@/modules/letters/build-letter';
import { loadLetter, type LetterCtx } from '@/modules/letters/server';
import { LETTER_TYPE } from '@/modules/letters/types';
import { track } from '@/modules/metrics/server';
import { resumeDocument } from '@/modules/resume/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST { document } → the letter as a PDF in that CV's design. Counts as a PDF download. */
export async function POST(req: Request, ctx: LetterCtx) {
  const r = await loadLetter(ctx);
  if ('error' in r) return r.error;
  const { rid, user, letter } = r;
  if (!letter.paragraphs.some((p) => p.trim()))
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
  const type = LETTER_TYPE[letter.type];
  try {
    const html = buildLetterHtml(
      doc.data,
      letter,
      {
        title: '',
        company: '',
        to: letter.to,
        subject: letter.subject,
        kind: type.title.toLowerCase(),
      },
      { fonts: { kind: 'inline', read: readFontBase64 } },
    );
    const { pdf } = await renderPdfFromHtml(await getBrowser(), html);
    await track('pdf_ok');
    const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slug(doc.data.basics.name || 'My')}-${slug(type.title)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    await gate.release();
    console.error(
      JSON.stringify({
        level: 'error',
        route: 'library letter pdf',
        rid,
        message: (e as Error).message,
      }),
    );
    return apiError('RENDER_FAILED', 'We couldn’t create the PDF just now.', rid);
  }
}
