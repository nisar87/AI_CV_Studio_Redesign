/**
 * Text extraction for CV import (R1.5). Runs on the server only; the uploaded file is read in
 * memory and never stored. Returns plain lines in reading order.
 */

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;
/** Below this many characters a PDF is treated as a scan and read by the vision model. */
export const SCAN_CHARS = 200;

export type ImportKind = 'pdf' | 'docx' | 'doc' | 'image';
export type Extracted = {
  kind: ImportKind;
  /** MIME type of the original (for the vision model). */
  mime: string;
  lines: string[];
  /** A scanned PDF or a photo: the text has to be read from the image. */
  scanned: boolean;
};

export class ImportError extends Error {
  constructor(
    readonly code: 'TOO_LARGE' | 'UNSUPPORTED' | 'NO_TEXT' | 'UNREADABLE' | 'TOO_LONG',
    message: string,
  ) {
    super(message);
  }
}

const ascii = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...b.subarray(from, to));

/** Identify the file by its bytes (never by its name or declared type alone). */
export function sniff(bytes: Uint8Array): { kind: ImportKind; mime: string } | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    return { kind: 'pdf', mime: 'application/pdf' };
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)
    return {
      kind: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  // Old binary Word (.doc) files start with the OLE2 signature.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)
    return { kind: 'doc', mime: 'application/msword' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { kind: 'image', mime: 'image/jpeg' };
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG')
    return { kind: 'image', mime: 'image/png' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP')
    return { kind: 'image', mime: 'image/webp' };
  // HEIC/HEIF (iPhone photos): an ISO box "ftyp" with a HEIF brand.
  if (
    ascii(bytes, 4, 8) === 'ftyp' &&
    /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(ascii(bytes, 8, 12))
  )
    return { kind: 'image', mime: 'image/heic' };
  return null;
}

export const ACCEPTED_NAMES = /\.(pdf|docx|doc|jpe?g|png|webp|heic|heif)$/i;

export const TOO_LARGE_MESSAGE = 'That file is larger than 10 MB. Please choose a smaller file.';
export const UNSUPPORTED_MESSAGE =
  'Please choose a PDF, a Word file (.docx or .doc) or a photo of your CV (JPG, PNG or HEIC).';

/**
 * Reads the text of a CV file. Scanned PDFs and photos come back with `scanned: true` (and few or
 * no lines); the caller sends those to the vision model (import/vision.ts).
 */
export async function extractLines(bytes: Uint8Array): Promise<Extracted> {
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new ImportError('TOO_LARGE', TOO_LARGE_MESSAGE);
  const type = sniff(bytes);
  if (!type) throw new ImportError('UNSUPPORTED', UNSUPPORTED_MESSAGE);
  const { kind, mime } = type;
  if (kind === 'image') return { kind, mime, lines: [], scanned: true };
  let lines: string[];
  try {
    lines =
      kind === 'pdf'
        ? await pdfLines(bytes)
        : kind === 'doc'
          ? await docLines(bytes)
          : await docxLines(bytes);
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(
      'UNREADABLE',
      'We couldn’t open that file. It may be damaged or password-protected.',
    );
  }
  lines = tidyLines(lines.map(clean).filter((l) => l.length > 0));
  const chars = lines.join('').length;
  if (kind === 'pdf' && chars < SCAN_CHARS) return { kind, mime, lines, scanned: true };
  if (chars < 20) throw new ImportError('NO_TEXT', 'This document looks empty.');
  return { kind, mime, lines, scanned: false };
}

/** The message when a scan cannot be read (vision unavailable or it found nothing). */
export const SCAN_UNREADABLE =
  'We couldn’t read the text in this file. It looks like a scan or a photo — please try a clearer photo, or upload the Word file or a PDF saved from Word.';

/** Joins pieces a PDF split across lines (emails, date ranges) and drops page counters. */
export function tidyLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    // Page counters ("1 / 2", "Page 1 of 2") and section numbers ("01", "02").
    if (/^(?:page\s*)?\d{1,2}\s*(?:\/|of)\s*\d{1,2}$/i.test(line) || /^0\d$/.test(line)) continue;
    const prev = out[out.length - 1];
    if (prev && (/[\w.+-]@$/.test(prev) || /^@/.test(line))) out[out.length - 1] = prev + line;
    else if (
      prev &&
      /(?:\d{4}|present)\s*[–—-]$/i.test(prev) &&
      /^(?:present|current|now|today|(?:[a-z]{3,9}\.?\s+)?\d{4}|\d{1,2}\/\d{4})$/i.test(line)
    )
      out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

function clean(s: string) {
  return s
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type Item = { str: string; x: number; y: number; w: number; h: number };

async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  if (pdf.numPages > MAX_PDF_PAGES)
    throw new ImportError(
      'TOO_LONG',
      `That PDF has ${pdf.numPages} pages. A CV import can have up to ${MAX_PDF_PAGES}.`,
    );
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items as {
      str?: string;
      transform?: number[];
      width?: number;
      height?: number;
    }[]) {
      if (!it.str || !it.transform) continue;
      items.push({
        // Word/Symbol-font bullets are private-use characters (e.g. U+F0B7); treat them as "•".
        str: it.str.replace(/[\uf000-\uf0ff]/g, '•'),
        x: it.transform[4] ?? 0,
        y: it.transform[5] ?? 0,
        w: it.width ?? 0,
        h: it.height ?? 0,
      });
    }
    out.push(...groupLines(items));
  }
  return out;
}

/**
 * Rebuild lines from positioned text. Two-column layouts are read column by column: a large
 * horizontal gap splits a row into separate cells, and cells are kept in content-stream order,
 * which for CVs printed by browsers and Word follows the reading order.
 */
export function groupLines(items: Item[]): string[] {
  const rows: { y: number; h: number; parts: Item[] }[] = [];
  // Keep stream order of first appearance; merge items on the same baseline.
  for (const it of items) {
    // Whitespace-only runs carry no text; dropping them keeps the real gaps measurable.
    if (!it.str.trim()) continue;
    const tol = Math.max(2, (it.h || 10) * 0.45);
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tol && near(r.parts, it));
    if (row) row.parts.push(it);
    else rows.push({ y: it.y, h: it.h, parts: [it] });
  }
  return rows.map((r) => {
    const parts = [...r.parts].sort((a, b) => a.x - b.x);
    let s = '';
    let end = -Infinity;
    for (const p of parts) {
      const gap = p.x - end;
      // Wide gaps separate cells (skill chips, date columns); normal gaps separate words.
      const marker = /^\s*[•●▪■◦○∙‣⁃*➢➤►▸✓✔–-]\s*$/.test(s);
      if (s && !marker && gap > (p.h || 10) * 0.55 && p.str.trim()) s = `${s.trimEnd()} · `;
      else if (s && gap > (p.h || 10) * 0.18 && !s.endsWith(' ') && !p.str.startsWith(' '))
        s += ' ';
      s += p.str;
      end = p.x + p.w;
    }
    return s;
  });
}

/** Same visual row only if horizontally adjacent (avoids joining two columns into one line). */
function near(parts: Item[], it: Item) {
  const size = it.h || 10;
  return parts.some((p) => it.x <= p.x + p.w + size * 2.5 && it.x + it.w >= p.x - size * 2.5);
}

async function docLines(bytes: Uint8Array): Promise<string[]> {
  const { default: WordExtractor } = await import('word-extractor');
  const doc = await new WordExtractor().extract(Buffer.from(bytes));
  return doc.getBody().split(/\r?\n/);
}

async function docxLines(bytes: Uint8Array): Promise<string[]> {
  const mammoth = await import('mammoth');
  // HTML keeps list structure (bullets) that raw text loses.
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  return htmlToLines(value);
}

export function htmlToLines(html: string): string[] {
  return html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|h[1-6]|li|tr|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .split(/\n/);
}
