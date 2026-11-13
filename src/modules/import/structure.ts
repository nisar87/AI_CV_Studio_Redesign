import type { TaskOutput } from '@/modules/ai/schemas';
import { newId } from '@/modules/resume/create';
import { IMPORT_KINDS } from '@/modules/ai/schemas';
import {
  designSpec,
  LAYOUT_KIND,
  type ResumeDocument,
  type Section,
} from '@/modules/resume/schema';
import { headingOf, type ImportReport } from './parse';

/**
 * Converts between the AI's generic import shape and the CV schema, and checks that the AI only
 * copied: every word of every content field must exist in the uploaded file. Pure; unit-tested.
 */
export type Structure = TaskOutput<'import.structure'>;
type Entry = Structure['sections'][number]['entries'][number];

const cut = (s: string, n: number) => s.trim().slice(0, n);

// ---------- faithfulness ----------

/** Words for comparison: lower-case letters/digits; "customer-facing" also gives its parts. */
export function words(s: string): string[] {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[’ʼ']/g, '')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

export type Fidelity = { ok: boolean; invented: string[] };

/**
 * Every word the AI wrote into a content field must be in the source. Labels the AI may
 * reasonably supply (section titles, link labels, "Other") are not checked; dates are checked
 * by schema. Returns the offending field texts.
 */
export function checkFidelity(s: Structure, sourceLines: string[]): Fidelity {
  const source = new Set(sourceLines.flatMap(words));
  // Month names and digits appear in source dates; normalised dates are not content fields.
  const invented: string[] = [];
  const check = (t: string) => {
    if (!t) return;
    const bad = words(t).filter((w) => !source.has(w));
    if (bad.length) invented.push(`${t.slice(0, 60)} [${bad.slice(0, 3).join(', ')}]`);
  };
  [s.name, s.headline, s.email, s.phone, s.location, s.summary].forEach(check);
  s.links.forEach((l) => check(l.url));
  for (const sec of s.sections)
    for (const e of sec.entries) {
      [e.title, e.subtitle, e.place].forEach(check);
      e.lines.forEach(check);
    }
  return { ok: invented.length === 0, invented };
}

/** Source lines whose words mostly don't appear anywhere in the result (so they'd be lost). */
export function uncoveredLines(s: Structure, sourceLines: string[]): string[] {
  const used = new Set(
    [
      s.name,
      s.headline,
      s.email,
      s.phone,
      s.location,
      s.summary,
      ...s.links.flatMap((l) => [l.label, l.url]),
      ...s.sections.flatMap((x) => [
        x.title,
        ...x.entries.flatMap((e) => [e.title, e.subtitle, e.place, ...e.lines]),
      ]),
    ].flatMap(words),
  );
  return sourceLines.filter((line) => {
    if (headingOf(line)) return false;
    // Dates are normalised (e.g. "January 2021 – Present" → 2021-01, current), so ignore them.
    const w = words(line).filter((x) => !/^\d+$/.test(x) && x.length > 1 && !DATE_WORDS.test(x));
    if (w.length < 2) return false;
    const missing = w.filter((x) => !used.has(x)).length;
    return missing / w.length > 0.5;
  });
}

const DATE_WORDS =
  /^(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|present|current|now|today|to|date|ongoing)$/;

// ---------- AI shape → CV ----------

const ymd = (s: string) => (/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(s.trim()) ? s.trim() : '');
const dates = (e: Entry) => ({
  start: ymd(e.start),
  end: e.current ? '' : ymd(e.end),
  current: e.current,
});

function toSection(sec: Structure['sections'][number]): Section | null {
  const base = { id: newId(), title: cut(sec.title, 80) || defaultTitle(sec.kind), hidden: false };
  const E = sec.entries;
  switch (sec.kind) {
    case 'experience':
    case 'volunteering':
      return {
        ...base,
        kind: sec.kind,
        items: E.map((e) => ({
          id: newId(),
          role: cut(e.title, 160),
          organization: cut(e.subtitle, 160),
          location: cut(e.place, 120),
          ...dates(e),
          bullets: e.lines.slice(0, 40).map((l) => cut(l, 600)),
        })),
      };
    case 'education':
      return {
        ...base,
        kind: 'education',
        items: E.map((e) => ({
          id: newId(),
          qualification: cut(e.title, 200),
          institution: cut(e.subtitle, 200),
          location: cut(e.place, 120),
          start: ymd(e.start),
          end: ymd(e.end),
          details: e.lines.slice(0, 40).map((l) => cut(l, 600)),
        })),
      };
    case 'projects':
      return {
        ...base,
        kind: 'projects',
        items: E.map((e) => ({
          id: newId(),
          name: cut(e.title, 160),
          role: cut(e.subtitle, 120),
          link: cut(e.place, 300),
          start: ymd(e.start),
          end: ymd(e.end),
          bullets: e.lines.slice(0, 40).map((l) => cut(l, 600)),
        })),
      };
    case 'skills':
      return {
        ...base,
        kind: 'skills',
        items: E.map((e) => ({
          id: newId(),
          label: cut(e.title, 80),
          keywords: e.lines.slice(0, 60).map((l) => cut(l, 160)),
        })),
      };
    case 'languages':
      return {
        ...base,
        kind: 'languages',
        items: E.map((e) => ({
          id: newId(),
          language: cut(e.title, 80),
          fluency: cut(e.subtitle, 240),
        })),
      };
    case 'certifications':
    case 'licences':
    case 'awards':
      return {
        ...base,
        kind: sec.kind,
        items: E.map((e) => ({
          id: newId(),
          name: cut(e.title, 200),
          issuer: cut(e.subtitle, 160),
          date: ymd(e.end) || ymd(e.start),
          detail: cut(e.lines.join(' '), 300),
        })),
      };
    default:
      return {
        ...base,
        kind: 'custom',
        items: E.map((e) => ({
          id: newId(),
          title: cut(e.title, 200),
          subtitle: cut([e.subtitle, e.place].filter(Boolean).join(' · '), 200),
          date: [e.start, e.end].filter(Boolean).join(' – ').slice(0, 60),
          bullets: e.lines.slice(0, 40).map((l) => cut(l, 600)),
        })),
      };
  }
}

const TITLES: Record<string, string> = {
  experience: 'Work experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  certifications: 'Certifications',
  licences: 'Licences',
  projects: 'Projects',
  volunteering: 'Volunteering',
  awards: 'Awards',
  custom: 'Other',
};
const defaultTitle = (k: string) => TITLES[k] ?? 'Other';

export function structureToDoc(
  s: Structure,
  extraLines: string[],
  opts: { now?: Date; locale?: string } = {},
): { doc: ResumeDocument; report: ImportReport } {
  const now = (opts.now ?? new Date()).toISOString();
  const sections = s.sections
    .map(toSection)
    .filter((x): x is Section => !!x && x.items.length > 0)
    .slice(0, 29);
  if (extraLines.length)
    sections.push({
      id: newId(),
      kind: 'custom',
      title: 'Other',
      hidden: false,
      items: [
        {
          id: newId(),
          title: '',
          subtitle: '',
          date: '',
          bullets: extraLines.slice(0, 40).map((l) => cut(l, 600)),
        },
      ],
    });
  const name = cut(s.name, 120);
  const doc: ResumeDocument = {
    schemaVersion: 1,
    id: newId(),
    title: (name ? `${name} — imported` : 'Imported CV').slice(0, 120),
    presetId: 'general',
    locale: opts.locale ?? 'en-GB',
    createdAt: now,
    updatedAt: now,
    basics: {
      name,
      headline: cut(s.headline, 160),
      email: cut(s.email, 160),
      phone: cut(s.phone, 60),
      location: cut(s.location, 160),
      links: s.links
        .filter((l) => l.url.trim())
        .slice(0, 10)
        .map((l) => ({ id: newId(), label: cut(l.label, 60) || 'Website', url: cut(l.url, 300) })),
      summary: cut(s.summary, 1500),
      photo: '',
    },
    sections,
    design: designSpec.parse({}),
  };
  return {
    doc,
    report: {
      name: !!doc.basics.name,
      email: !!doc.basics.email,
      phone: !!doc.basics.phone,
      summary: !!doc.basics.summary,
      sections: doc.sections.map((x) => ({ kind: x.kind, title: x.title, items: x.items.length })),
      unplaced: extraLines.length,
    },
  };
}

// ---------- CV → AI shape (used by the demo provider in tests) ----------

export function docToStructure(d: ResumeDocument): Structure {
  const entry = (p: Partial<Entry>): Entry => ({
    title: '',
    subtitle: '',
    place: '',
    start: '',
    end: '',
    current: false,
    lines: [],
    ...p,
  });
  return {
    name: d.basics.name,
    headline: d.basics.headline,
    email: d.basics.email,
    phone: d.basics.phone,
    location: d.basics.location,
    links: d.basics.links.map((l) => ({ label: l.label, url: l.url })),
    summary: d.basics.summary,
    // Only the kinds the importer knows; R8 section types are not produced by import.
    sections: d.sections
      .filter((s) => s.kind === LAYOUT_KIND[s.kind])
      .map((s) => ({
        kind: s.kind as (typeof IMPORT_KINDS)[number],
        title: s.title,
        entries: s.items.map((it) => {
          switch (s.kind) {
            case 'experience':
            case 'volunteering': {
              const x = it as Extract<Section, { kind: 'experience' }>['items'][number];
              return entry({
                title: x.role,
                subtitle: x.organization,
                place: x.location,
                start: x.start,
                end: x.end,
                current: x.current,
                lines: x.bullets,
              });
            }
            case 'education': {
              const x = it as Extract<Section, { kind: 'education' }>['items'][number];
              return entry({
                title: x.qualification,
                subtitle: x.institution,
                place: x.location,
                start: x.start,
                end: x.end,
                lines: x.details,
              });
            }
            case 'projects': {
              const x = it as Extract<Section, { kind: 'projects' }>['items'][number];
              return entry({
                title: x.name,
                subtitle: x.role,
                place: x.link,
                start: x.start,
                end: x.end,
                lines: x.bullets,
              });
            }
            case 'skills': {
              const x = it as Extract<Section, { kind: 'skills' }>['items'][number];
              return entry({ title: x.label, lines: x.keywords });
            }
            case 'languages': {
              const x = it as Extract<Section, { kind: 'languages' }>['items'][number];
              return entry({ title: x.language, subtitle: x.fluency });
            }
            case 'custom': {
              const x = it as Extract<Section, { kind: 'custom' }>['items'][number];
              return entry({ title: x.title, subtitle: x.subtitle, lines: x.bullets });
            }
            default: {
              const x = it as Extract<Section, { kind: 'certifications' }>['items'][number];
              return entry({
                title: x.name,
                subtitle: x.issuer,
                end: x.date,
                lines: x.detail ? [x.detail] : [],
              });
            }
          }
        }),
      })),
  };
}
