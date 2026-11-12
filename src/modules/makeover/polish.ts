import { healthCheck, type Finding } from '@/modules/quality/health';
import type { ResumeDocument } from '@/modules/resume/schema';

/**
 * Polish chips (spec §6.4): deterministic counts shown on the chips, the lines a chip may change
 * (addressed by id), and applying accepted suggestions. Suggestions themselves come from the
 * makeover.diagnose task, lazily, when a chip is opened.
 */
export type Chip = 'wording' | 'bullets' | 'gaps';
export type PolishLine = { id: string; text: string };
export type Suggestion = { id: string; after: string; reason: string };

const LINE_FIELDS = ['bullets', 'details'] as const;
const BULLET_KINDS = new Set(['experience', 'volunteering', 'projects']);

/** Addressable lines: "summary" and "<sectionId>/<itemId>/<field>/<index>". */
export function polishLines(doc: ResumeDocument, chip: 'wording' | 'bullets'): PolishLine[] {
  const out: PolishLine[] = [];
  if (chip === 'wording' && doc.basics.summary.trim())
    out.push({ id: 'summary', text: doc.basics.summary });
  for (const s of doc.sections) {
    if (s.hidden || s.kind === 'skills' || s.kind === 'languages') continue;
    if (chip === 'bullets' && !BULLET_KINDS.has(s.kind)) continue;
    for (const it of s.items as Record<string, unknown>[]) {
      for (const f of LINE_FIELDS) {
        const arr = it[f];
        if (!Array.isArray(arr)) continue;
        arr.forEach((t, k) => {
          if (typeof t === 'string' && t.trim())
            out.push({ id: `${s.id}/${String(it.id)}/${f}/${k}`, text: t });
        });
      }
    }
  }
  return out.slice(0, 60);
}

const COMMON_MISSPELLINGS =
  /\b(responsable|managment|recieved?|costumers?|acheive\w*|seperate\w*|occured|untill|wich|teh|definately|maintainance|enviroment|sucessful\w*|refered|comittee|accomodat\w*|experiance|profesional|knowlege|bussiness|reponsible|independant)\b/i;
const WEAK =
  /^(responsible for|duties (included|include)|tasks (included|include)|worked on|helped( with)?|in charge of|involved in|assisted with|my (duties|role|job))\b/i;

/** A line probably needs a wording fix: spelling, first person, lower-case start, spacing. */
export function wordingIssue(t: string): boolean {
  const s = t.trim();
  return (
    COMMON_MISSPELLINGS.test(s) ||
    /(^|\s)(I|my|me)\s/.test(` ${s} `) ||
    /^\p{Ll}/u.test(s) ||
    /\s{2,}|\s[,.;:]/.test(t) ||
    /\b(\w+) \1\b/i.test(s)
  );
}

/** A bullet probably needs strengthening: weak opening, run-on or very long. */
export function weakBullet(t: string): boolean {
  const s = t.trim();
  const words = s.split(/\s+/).length;
  return WEAK.test(s) || words > 32 || (s.match(/,/g) ?? []).length >= 4;
}

const GAP_IDS = new Set([
  'name',
  'contact',
  'email-format',
  'phone-format',
  'location',
  'summary-missing',
  'history',
  'dates-missing',
  'bullets-missing',
  'gap',
]);

/** Missing or questionable facts only the person can supply ("Fill gaps"). */
export function gapFindings(doc: ResumeDocument): Finding[] {
  return healthCheck(doc).findings.filter((f) => GAP_IDS.has(f.id));
}

export function chipCounts(doc: ResumeDocument): Record<Chip, number> {
  return {
    wording: polishLines(doc, 'wording').filter((l) => wordingIssue(l.text)).length,
    bullets: polishLines(doc, 'bullets').filter((l) => weakBullet(l.text)).length,
    gaps: gapFindings(doc).length,
  };
}

/** Applies accepted suggestions to a copy of the document. Unknown ids are ignored. */
export function applySuggestions(doc: ResumeDocument, accepted: Suggestion[]): ResumeDocument {
  const next = structuredClone(doc);
  for (const s of accepted) {
    if (s.id === 'summary') {
      next.basics.summary = s.after;
      continue;
    }
    const [sid, iid, field, k] = s.id.split('/');
    const sec = next.sections.find((x) => x.id === sid);
    const item = (sec?.items as Record<string, unknown>[] | undefined)?.find((x) => x.id === iid);
    const arr = item?.[field as string];
    const idx = Number(k);
    if (Array.isArray(arr) && Number.isInteger(idx) && idx >= 0 && idx < arr.length)
      arr[idx] = s.after;
  }
  return next;
}

/** The CV's other words (names, employers, titles): context the truth guard may accept. */
export function polishContext(doc: ResumeDocument): string {
  const out = [doc.basics.name, doc.basics.headline, doc.basics.location];
  for (const s of doc.sections)
    for (const it of s.items as Record<string, unknown>[])
      for (const [k, v] of Object.entries(it))
        if (typeof v === 'string' && k !== 'id') out.push(v);
        else if (k === 'keywords' && Array.isArray(v)) out.push(v.join(', '));
  return out.filter(Boolean).join('\n').slice(0, 12_000);
}
