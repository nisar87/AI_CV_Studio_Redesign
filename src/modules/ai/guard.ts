/**
 * Deterministic truth guard (docs/engineering/ai-architecture.md → Validation and guards).
 *
 * AI may rephrase, reorder, shorten and choose stronger verbs. It may not add facts that are not
 * in the person's own text: numbers, years, organisation or product names, or qualifications.
 * Anything it adds is replaced with a `{{?…}}` marker so the person must confirm or replace it.
 * False positives (a harmless word marked for checking) are acceptable; invented facts are not.
 */

export type FindingKind = 'number' | 'year' | 'name' | 'credential';
export type Finding = { kind: FindingKind; value: string };

export type Source = { words: Set<string>; numbers: Set<string>; text: string };

const NUMBER_WORDS: Record<string, string> = {
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  fifteen: '15',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  hundred: '100',
  hundreds: '100s',
  thousand: '1000',
  thousands: '1000s',
  dozen: '12',
  dozens: '12s',
  million: '1000000',
  millions: '1000000s',
};

/**
 * Words that signal a formal qualification, licence or award. If the output uses one that the
 * person never wrote, the claim may be invented.
 */
const CREDENTIAL_WORDS = [
  'certified',
  'certificate',
  'certification',
  'chartered',
  'accredited',
  'licensed',
  'licence',
  'license',
  'qualified',
  'degree',
  'diploma',
  'bachelor',
  "bachelor's",
  'master',
  "master's",
  'masters',
  'doctorate',
  'phd',
  'mba',
  'bsc',
  'msc',
  'ba',
  'ma',
  'pgce',
  'qts',
  'nvq',
  'gcse',
  'a-level',
  'cpr',
  'cscs',
  'hgv',
  'cpc',
  'award-winning',
  'awarded',
  'award',
  'registered',
];
const CREDENTIAL_SET = new Set(CREDENTIAL_WORDS);

/** Word families: "certification" is not new if the person wrote "certified" or "certificate". */
const CREDENTIAL_FAMILIES = [
  /^certif/,
  /^licen[cs]/,
  /^qualifi/,
  /^regist/,
  /^accredit/,
  /^charter/,
  /^award/,
  /^master/,
  /^bachelor/,
];
function credentialKnown(w: string, source: Source) {
  const fam = CREDENTIAL_FAMILIES.find((re) => re.test(w));
  if (!fam) return false;
  for (const x of source.words) if (fam.test(x)) return true;
  return false;
}

/** Generic second halves of compounds: "AWS-based", "NHS-led", "customer-facing". */
const GENERIC_PARTS = new Set([
  'based',
  'led',
  'driven',
  'focused',
  'facing',
  'oriented',
  'related',
  'wide',
  'level',
  'style',
  'friendly',
  'ready',
  'first',
  'heavy',
  'specific',
  'centred',
  'centered',
]);
/** "NMC-registered" is known when "NMC" and "registered" both appear in the source. */
const partsKnown = (w: string, source: Source) =>
  /[-/]/.test(w) &&
  w.split(/[-/]+/).every((p, i) => !p || source.words.has(p) || (i > 0 && GENERIC_PARTS.has(p)));

/** Sentence openers never joined into a flagged name ("A GMC-registered…" flags only the name). */
const OPENERS = new Set(['a', 'an', 'the', 'my', 'our', 'this', 'as', 'in', 'at', 'with', 'for']);

/** Capitalised words that are not names (still checked if they carry a number). */
const ALLOW_CAPITALISED = new Set(['i', "i'm", "i'd", "i'll", "i've", 'cv', 'ats', 'ok']);

const normalise = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’&.+#-]*/gu;

const stripWord = (w: string) =>
  normalise(w)
    .replace(/['’]s$/, '')
    .replace(/[.'’-]+$/, '');

function numberKey(raw: string): string {
  return raw
    .replace(/[,\s]/g, '')
    .replace(/\.0+$/, '')
    .replace(/^0+(?=\d)/, '');
}

/** Build the set of facts the person actually provided. `extraNumbers` = values derived from their data (e.g. years of experience). */
export function buildSource(texts: string[], extraNumbers: number[] = []): Source {
  const text = normalise(texts.filter(Boolean).join('\n'));
  const words = new Set<string>();
  for (const m of text.matchAll(WORD_RE)) {
    const w = stripWord(m[0]);
    words.add(w);
    // "health-and-safety" → also its parts; "b.sc" → "bsc"
    for (const part of w.split(/[-/&.]+/)) if (part) words.add(part);
    words.add(w.replace(/\./g, ''));
  }
  const numbers = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    numbers.add(numberKey(m[0]));
    // "2015-03" style dates also provide "2015" and "3"
  }
  for (const [word, digits] of Object.entries(NUMBER_WORDS)) {
    if (words.has(word)) numbers.add(digits.replace(/s$/, ''));
  }
  for (const n of extraNumbers) numbers.add(String(n));
  return { words, numbers, text };
}

/** Before a sentence start: punctuation, a line break, or an opening bracket or quote. */
const SENTENCE_BREAK = /(?:[.!?:;•\n(]\s*|[.!?:;•\n(]?\s*['"‘“])$/;

type Replace = { start: number; end: number; marker: string; finding: Finding };

/** Check one string against the source. Returns the text with unsupported facts marked. */
export function guardText(input: string, source: Source): { text: string; findings: Finding[] } {
  // Keep model-written markers; tidy malformed braces.
  const segments: { text: string; keep: boolean }[] = [];
  let last = 0;
  for (const m of input.matchAll(/\{\{\?([^{}]{1,160})\}\}/g)) {
    if (m.index! > last) segments.push({ text: input.slice(last, m.index), keep: false });
    segments.push({ text: `{{?${m[1]!.trim()}}}`, keep: true });
    last = m.index! + m[0].length;
  }
  if (last < input.length) segments.push({ text: input.slice(last), keep: false });

  const findings: Finding[] = [];
  const out = segments
    .map((seg, i) => {
      if (seg.keep) return seg.text;
      const before = segments
        .slice(0, i)
        .map((s) => s.text)
        .join('');
      const r = guardSegment(seg.text.replace(/\{\{|\}\}/g, ''), source, before);
      findings.push(...r.findings);
      return r.text;
    })
    .join('');
  return { text: out.replace(/\s{2,}/g, ' ').trim(), findings };
}

function guardSegment(text: string, source: Source, before: string) {
  const reps: Replace[] = [];

  // 1. Numbers (digits, with optional %, k, +). Years get their own message.
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const key = numberKey(m[0]);
    if (source.numbers.has(key)) continue;
    const isYear =
      /^(19|20)\d{2}$/.test(m[0]) &&
      !/[£$€¥₹]\s*$/.test(text.slice(0, m.index)) &&
      !/^%/.test(text.slice(m.index! + m[0].length));
    reps.push({
      start: m.index!,
      end: m.index! + m[0].length,
      marker: isYear ? '{{?add the year}}' : '{{?add the real number}}',
      finding: { kind: isYear ? 'year' : 'number', value: m[0] },
    });
  }

  // 2. Words: number words, credential words, and names.
  const words = [...text.matchAll(WORD_RE)];
  let run: { start: number; end: number; words: string[] } | null = null;
  let pending: { start: number; end: number; raw: string } | null = null;
  const flushRun = () => {
    if (run) {
      const value = text.slice(run.start, run.end).replace(/['’]s$/, '');
      reps.push({
        start: run.start,
        end: run.start + value.length,
        marker: `{{?confirm: ${value}}}`,
        finding: { kind: 'name', value },
      });
    }
    run = null;
  };
  for (const m of words) {
    const raw = m[0];
    const start = m.index!;
    const end = start + raw.length;
    if (/^\d/.test(raw)) {
      flushRun();
      continue;
    }
    const w = stripWord(raw);
    const known =
      source.words.has(w) || source.words.has(w.replace(/\./g, '')) || partsKnown(w, source);

    if (NUMBER_WORDS[w] && !known && !source.numbers.has(NUMBER_WORDS[w]!.replace(/s$/, ''))) {
      flushRun();
      reps.push({
        start,
        end,
        marker: '{{?add the real number}}',
        finding: { kind: 'number', value: raw },
      });
      continue;
    }
    if (CREDENTIAL_SET.has(w) && !known && !credentialKnown(w, source)) {
      flushRun();
      reps.push({
        start,
        end,
        marker: `{{?confirm: ${raw}}}`,
        finding: { kind: 'credential', value: raw },
      });
      continue;
    }

    const capitalised = /^\p{Lu}/u.test(raw) || /\p{Ll}\p{Lu}/u.test(raw);
    const prefix = before + text.slice(0, start);
    const sentenceStart = prefix.trim() === '' || SENTENCE_BREAK.test(prefix);
    const acronym = /^\p{Lu}{2,}/u.test(raw) || /\p{Ll}\p{Lu}/u.test(raw);
    const nameLike = capitalised && (!sentenceStart || acronym || (run !== null && !known));
    if (nameLike && !known && !ALLOW_CAPITALISED.has(w.replace(/’/g, "'"))) {
      // "Amazon Flex …" at the start of a sentence: include the first word too, unless it
      // looks like a verb ("Delivered Amazon …").
      if (!run && pending && /^\s+$/.test(text.slice(pending.end, start))) {
        run = { start: pending.start, end: pending.end, words: [pending.raw] };
      }
      pending = null;
      // Join adjacent unknown capitalised words ("Royal Mail") into one marker.
      const gap = run ? text.slice(run.end, start) : '';
      if (run && /^\s*(?:&|and|of|the)?\s*$/i.test(gap)) {
        run.end = end;
        run.words.push(raw);
      } else {
        flushRun();
        run = { start, end, words: [raw] };
      }
      continue;
    }
    pending =
      capitalised && sentenceStart && !known && !/(?:ed|ing|ly)$/i.test(raw) && !OPENERS.has(w)
        ? { start, end, raw }
        : null;
    flushRun();
  }
  flushRun();

  // Apply from the end; drop overlaps (a number inside a flagged name).
  reps.sort((a, b) => a.start - b.start);
  const kept: Replace[] = [];
  for (const r of reps) {
    const prev = kept[kept.length - 1];
    if (prev && r.start < prev.end) continue;
    kept.push(r);
  }
  let outText = text;
  for (const r of [...kept].reverse()) {
    outText = outText.slice(0, r.start) + r.marker + outText.slice(r.end);
  }
  // "£{{?add the real number}}k" → keep the marker readable
  outText = outText.replace(/(\{\{\?add the real number\}\})[kKmM%+]+/g, '$1');
  return { text: outText, findings: kept.map((r) => r.finding) };
}

/** Guard many strings against one source. */
export function guardAll(texts: string[], source: Source) {
  const findings: Finding[] = [];
  const out = texts.map((t) => {
    const r = guardText(t, source);
    findings.push(...r.findings);
    return r.text;
  });
  return { texts: out, findings };
}

/** Years of experience the person's dates support (e.g. 2015 → now = 9 or 10), so summaries may state them. */
export function derivedYears(
  jobs: { start: string; end: string; current: boolean }[],
  now = new Date(),
): number[] {
  const years = (d: string) => (d ? Number(d.slice(0, 4)) : NaN);
  const starts = jobs.map((j) => years(j.start)).filter((n) => !Number.isNaN(n));
  if (!starts.length) return [];
  const ends = jobs.map((j) => (j.current ? now.getFullYear() : years(j.end || j.start)));
  const span = Math.max(...ends.filter((n) => !Number.isNaN(n))) - Math.min(...starts);
  const out = new Set<number>();
  for (const s of [span - 1, span, span + 1]) if (s > 0) out.add(s);
  for (const j of jobs) {
    const s = years(j.start);
    const e = j.current ? now.getFullYear() : years(j.end);
    if (!Number.isNaN(s) && !Number.isNaN(e) && e - s > 0) {
      out.add(e - s);
      out.add(e - s + 1);
    }
  }
  return [...out];
}
