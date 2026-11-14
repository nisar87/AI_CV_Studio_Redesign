/**
 * LinkedIn review (complete-studio-spec §10: "Upload the LinkedIn PDF export; get a
 * section-by-section review and rewritten text"). Pure helpers shared by the AI task's finalize,
 * the route, the evaluation and the tests.
 */

export const SECTION_KEYS = [
  'headline',
  'about',
  'experience',
  'skills',
  'education',
  'certifications',
  'contact',
  'other',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export type SectionStatus = 'good' | 'improve' | 'missing';

/** LinkedIn's own limits, so a suggestion always fits the box it is pasted into. */
export const LINKEDIN_LIMITS: Record<SectionKey, number> = {
  headline: 220,
  about: 2600,
  experience: 2000,
  skills: 1000,
  education: 1000,
  certifications: 1000,
  contact: 300,
  other: 2000,
};

export type ReviewSection = {
  key: SectionKey;
  title: string;
  status: SectionStatus;
  /** The profile's own words for this section (checked to be in the export), or ''. */
  current: string;
  notes: string[];
  /** Text ready to paste ('' when the section is fine as it is). */
  rewrite: string;
};
export type LinkedinReview = {
  overall: string;
  sections: ReviewSection[];
};

/** The headings LinkedIn's "Save to PDF" export uses. */
const HEADINGS = new Set([
  'contact',
  'top skills',
  'languages',
  'certifications',
  'honors-awards',
  'publications',
  'patents',
  'summary',
  'experience',
  'education',
  'volunteer experience',
  'projects',
]);
const DATE_RANGE =
  /^(?:january|february|march|april|may|june|july|august|september|october|november|december)?\s*\d{4}\s*-\s*(?:present|(?:january|february|march|april|may|june|july|august|september|october|november|december)?\s*\d{4})(?:\s*\(.*\))?$/i;

/** Whether the file's text looks like LinkedIn's PDF export (checked before any AI is used). */
export function looksLikeLinkedin(lines: string[]): boolean {
  const text = lines.join('\n');
  const headings = lines.filter((l) => HEADINGS.has(l.trim().toLowerCase())).length;
  const hasProfileLink = /linkedin\.com\/in\//i.test(text.replace(/-\n/g, '-'));
  const hasExperience = lines.some((l) => l.trim().toLowerCase() === 'experience');
  return (hasExperience && headings >= 3) || (hasProfileLink && headings >= 2);
}

/** Counted from the file, so the model doesn't have to count (and can't miscount). */
export function exportFacts(lines: string[]) {
  const lower = lines.map((l) => l.trim().toLowerCase());
  const at = (h: string) => lower.indexOf(h);
  const block = (h: string) => {
    const i = at(h);
    if (i < 0) return [];
    const out: string[] = [];
    for (let k = i + 1; k < lines.length && !HEADINGS.has(lower[k]!); k++) out.push(lines[k]!);
    return out;
  };
  const summary = block('summary').join(' ').trim();
  const url = lines.join('').match(/linkedin\.com\/in\/([\w-]+)/i)?.[1] ?? '';
  return {
    hasSummary: summary.length > 0,
    summaryChars: summary.length,
    jobs: lines.filter((l) => DATE_RANGE.test(l.trim())).length,
    topSkills: block('top skills').length,
    hasCertifications: at('certifications') >= 0,
    /** A profile address ending in random letters and digits (LinkedIn's default). */
    defaultUrl: /-[a-z0-9]*\d[a-z0-9]*$/i.test(url),
  };
}
export type ExportFacts = ReturnType<typeof exportFacts>;

/** The facts as lines for the prompt. */
export const factsLines = (f: ExportFacts) =>
  [
    `About (Summary) section: ${f.hasSummary ? `${f.summaryChars} characters` : 'none'}`,
    `Jobs listed: ${f.jobs}`,
    `Top skills shown: ${f.topSkills}`,
    `Certifications section: ${f.hasCertifications ? 'yes' : 'no'}`,
    `Profile address: ${f.defaultUrl ? 'LinkedIn’s default (ends in random characters)' : 'personal or unknown'}`,
  ].join('\n');

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Whether a quote is really in the export. Lines in a PDF wrap anywhere, so the text is joined
 * with spaces and also with nothing (for words split across lines like "imran-\nqureshi").
 */
export function onPage(exportText: string, quote: string): boolean {
  if (norm(quote).length < 2) return false;
  const spaced = norm(exportText);
  const joined = norm(exportText.replace(/-\n/g, '-').replace(/\n/g, ' '));
  // A quote may skip the middle of a long paragraph with "…"; each part must be on the page.
  const parts = quote
    .split(/…|\.\.\./)
    .map(norm)
    .filter((p) => p.length > 1);
  return parts.length > 0 && parts.every((p) => spaced.includes(p) || joined.includes(p));
}

const clip = (s: string, n: number) => {
  const t = s.trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  return (end > n * 0.6 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '')).trim();
};

/** "Driving, driving, Customer Service, customer service" → each skill once (first spelling kept). */
export function uniqueSkills(list: string): string {
  const seen = new Set<string>();
  return list
    .split(/\s*[,;\n]\s*/)
    .map((x) => x.trim())
    .filter((x) => {
      const k = x.toLowerCase();
      if (!x || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(', ');
}

/**
 * Makes the model's review safe to show: quotes not in the export are dropped, "missing"
 * sections have no quote, suggestions fit LinkedIn's limits, sections come in profile order, and
 * a section with nothing to say is left out.
 */
export function tidyReview(
  o: { overall: string; sections: ReviewSection[] },
  exportText: string,
): LinkedinReview {
  const seen = new Set<string>();
  const sections = o.sections
    .map((s) => {
      const key = (SECTION_KEYS as readonly string[]).includes(s.key) ? s.key : 'other';
      const status: SectionStatus =
        s.status === 'good' || s.status === 'missing' ? s.status : 'improve';
      const current =
        status === 'missing' || !onPage(exportText, s.current) ? '' : clip(s.current, 1500);
      return {
        key,
        title: s.title.replace(/\s+/g, ' ').trim().slice(0, 120) || key,
        status,
        current,
        notes: s.notes
          .map((n) => n.trim())
          .filter(Boolean)
          .slice(0, 4),
        rewrite:
          status === 'good'
            ? ''
            : clip(key === 'skills' ? uniqueSkills(s.rewrite) : s.rewrite, LINKEDIN_LIMITS[key]),
      };
    })
    .filter((s) => s.notes.length > 0 || s.rewrite)
    .filter((s) => {
      const id = `${s.key}|${s.title.toLowerCase()}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((s, i) => ({ s, i }))
    .sort((a, b) => SECTION_KEYS.indexOf(a.s.key) - SECTION_KEYS.indexOf(b.s.key) || a.i - b.i)
    .map(({ s }) => s);
  return { overall: o.overall.trim(), sections };
}

/** `{{?confirm: X}}` → `[confirm: X]` so the person can see and replace it in a text box. */
export const visibleMarkers = (s: string) => s.replace(/\{\{\?([^{}]*)\}\}/g, '[$1]');
