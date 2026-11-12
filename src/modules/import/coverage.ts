import type { ResumeDocument } from '@/modules/resume/schema';

/**
 * Coverage check (spec §6.2 step 6): how much of the original's content made it into the new CV.
 * Compares distinct content words; dates are rewritten (YYYY-MM) and bullet symbols dropped, so
 * month names, numbers and very short words are not counted.
 */
export const COVERAGE_TARGET = 0.97;

const MONTHS =
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|present|current|now|today)$/;
const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'that',
  'this',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'our',
  'their',
  'his',
  'her',
  'its',
  'per',
  'via',
  'all',
  'any',
  'not',
  'but',
  'out',
  'also',
]);

export function contentWords(text: string): string[] {
  return (
    text
      .toLowerCase()
      .normalize('NFC')
      .match(/\p{L}[\p{L}'’-]*/gu) ?? []
  )
    .map((w) => w.replace(/['’]s$/, '').replace(/^[-'’]+|[-'’]+$/g, ''))
    .filter((w) => w.length >= 3 && !STOP.has(w) && !MONTHS.test(w));
}

/** Every user-visible string of the document (not ids or design settings). */
export function documentText(doc: ResumeDocument): string {
  const out: string[] = [];
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'string') {
      if (key !== 'id' && key !== 'photo' && key !== 'kind') out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, k);
  };
  walk(doc.basics);
  walk(doc.sections);
  return out.join('\n');
}

export type Coverage = {
  /** Share of the original's distinct content words found in the new CV (0–1). */
  ratio: number;
  /** Original lines with at least one content word missing from the new CV. */
  missing: string[];
};

export function coverage(lines: string[], doc: ResumeDocument): Coverage {
  const have = new Set(contentWords(documentText(doc)));
  const want = new Set(lines.flatMap(contentWords));
  if (want.size === 0) return { ratio: 1, missing: [] };
  let found = 0;
  for (const w of want) if (have.has(w)) found++;
  const missing = lines.filter((l) => contentWords(l).some((w) => !have.has(w)));
  return { ratio: found / want.size, missing: missing.slice(0, 50) };
}
