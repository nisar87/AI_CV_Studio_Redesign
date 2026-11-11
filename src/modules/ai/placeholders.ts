/**
 * "Needs your input" markers: `{{?How many deliveries a day?}}`.
 * AI tasks insert these instead of inventing facts; the editor, preview and download
 * checklist all recognise them. Safe to import on client and server.
 */
export const PLACEHOLDER_RE = /\{\{\?([^{}]{1,160})\}\}/g;

export function hasPlaceholder(text: string): boolean {
  PLACEHOLDER_RE.lastIndex = 0;
  return PLACEHOLDER_RE.test(text);
}

/** Unique placeholder questions, in order of appearance. */
export function placeholderQuestions(texts: string | string[]): string[] {
  const out: string[] = [];
  for (const t of Array.isArray(texts) ? texts : [texts]) {
    for (const m of t.matchAll(PLACEHOLDER_RE)) {
      const q = m[1]!.trim();
      if (q && !out.includes(q)) out.push(q);
    }
  }
  return out;
}

export type TextPart = { kind: 'text'; text: string } | { kind: 'ask'; text: string };

/** Split text into plain parts and placeholder parts (for highlighting). */
export function splitPlaceholders(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    if (m.index! > last) parts.push({ kind: 'text', text: text.slice(last, m.index) });
    parts.push({ kind: 'ask', text: m[1]!.trim() });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
