import 'server-only';
import { track } from '@/modules/metrics/server';
import type { ResumeDocument } from '@/modules/resume/schema';
import { importWithAi } from './ai';
import { coverage, type Coverage } from './coverage';
import { extractLines, ImportError, SCAN_UNREADABLE, type ImportKind } from './extract';
import { parseCv, type ImportReport } from './parse';
import { transcribeFile } from './vision';

export type ReadCv = {
  doc: ResumeDocument;
  report: ImportReport;
  method: 'ai' | 'rules';
  kind: ImportKind;
  /** The text was read from an image (scan or photo): ask the person to check names and numbers. */
  scanned: boolean;
  /** The vision model saw a photo of the person on the page. */
  photo: boolean;
  /** The original's text lines (for the "before" view of Word files and the coverage panel). */
  lines: string[];
  coverage: Coverage;
};

/**
 * One CV file → a ResumeDocument (spec §6.2 steps 1–6): identify → extract text → vision for
 * scans → structure (AI, verified copy-only; rules as the fallback) → coverage check.
 * Throws ImportError with a plain message the person can act on.
 */
export async function readCv(
  bytes: Uint8Array,
  opts: { key: string; locale: string; ai: boolean },
): Promise<ReadCv> {
  // Requests end after about a minute on the host, so the AI steps share one time budget.
  const started = Date.now();
  const ex = await extractLines(bytes);
  let { lines } = ex;
  let photo = false;
  if (ex.scanned) {
    if (!opts.ai) throw new ImportError('NO_TEXT', SCAN_UNREADABLE);
    const t = await transcribeFile(bytes, ex.mime, opts.key);
    await track(t.ok ? 'vision_ok' : 'vision_fail');
    if (!t.ok) {
      console.warn(
        JSON.stringify({ level: 'warn', area: 'import', event: 'vision_failed', reason: t.reason }),
      );
      throw new ImportError('NO_TEXT', SCAN_UNREADABLE);
    }
    lines = t.lines;
    photo = t.photo;
  }
  const left = 55_000 - (Date.now() - started);
  const ai =
    opts.ai && left > 12_000
      ? await importWithAi(lines, opts.key, { locale: opts.locale, timeoutMs: left })
      : ({ ok: false, reason: opts.ai ? 'no_time' : 'switched_off' } as const);
  const { doc, report } = ai.ok ? ai : parseCv(lines, { locale: opts.locale });
  if (/-(US|CA)$/.test(opts.locale)) doc.design.pageSize = 'Letter';
  return {
    doc,
    report,
    method: ai.ok ? 'ai' : 'rules',
    kind: ex.kind,
    scanned: ex.scanned,
    photo,
    lines,
    coverage: coverage(lines, doc),
  };
}
