import type { PresetId } from '@/modules/resume/professions';
import { DESIGNS } from '@/modules/design/designs';
import type { DesignId, ResumeDocument, TemplateId } from '@/modules/resume/schema';

/**
 * Design ranking (spec §6.3): a deterministic score per design, so the result is explainable and
 * testable. No AI call. Profession 0–40, length 0–20, photo 0–15, density 0–15; then a variety
 * rule makes sure the strip shows visibly different layouts.
 */
export type Family = 'single' | 'sidebar';
export type DesignTraits = {
  family: Family;
  /** Strong colour or a large name: visibly "bold". */
  bold: boolean;
  /** Dates in a margin (good for long histories). */
  timeline: boolean;
  photo: boolean;
  /** Fit per kind of work, 0–1. Missing = 0.4 (neutral). */
  fit: Partial<Record<PresetId, number>>;
};

const CRAFTED_TRAITS: Record<TemplateId, DesignTraits> = {
  clarity: {
    family: 'single',
    bold: false,
    timeline: false,
    photo: true,
    fit: { general: 1, office: 0.9, tech: 0.8, driver: 0.8, trades: 0.7, retail: 0.6 },
  },
  meridian: {
    family: 'sidebar',
    bold: true,
    timeline: false,
    photo: true,
    fit: { healthcare: 1, office: 0.8, retail: 0.7, general: 0.7, teacher: 0.6 },
  },
  heritage: {
    family: 'single',
    bold: false,
    timeline: false,
    photo: false,
    fit: { executive: 1, office: 0.7, teacher: 0.6, healthcare: 0.5 },
  },
  atelier: {
    family: 'sidebar',
    bold: true,
    timeline: false,
    photo: true,
    fit: { tech: 0.7, student: 0.7, retail: 0.6, office: 0.5 },
  },
  ledger: {
    family: 'single',
    bold: true,
    timeline: false,
    photo: true,
    fit: { tech: 1, executive: 0.7, office: 0.6 },
  },
  chronicle: {
    family: 'single',
    bold: false,
    timeline: true,
    photo: true,
    fit: { trades: 1, driver: 1, healthcare: 0.6, executive: 0.6, office: 0.5 },
  },
  vivid: {
    family: 'sidebar',
    bold: true,
    timeline: false,
    photo: true,
    fit: { student: 1, retail: 0.9, tech: 0.5 },
  },
  folio: {
    family: 'sidebar',
    bold: false,
    timeline: false,
    photo: true,
    fit: { executive: 0.8, office: 0.6, teacher: 0.6, tech: 0.5 },
  },
  halo: {
    family: 'sidebar',
    bold: false,
    timeline: false,
    photo: true,
    fit: { teacher: 1, healthcare: 0.9, retail: 0.6, student: 0.6 },
  },
  sprout: {
    family: 'sidebar',
    bold: true,
    timeline: false,
    photo: true,
    fit: { student: 1, retail: 1, driver: 0.6, healthcare: 0.5 },
  },
};

/**
 * Traits of every catalogue design: the 10 crafted designs keep their tuned values; the R7
 * spec-only designs take theirs from the catalogue metadata.
 */
export const DESIGN_TRAITS: Record<DesignId, DesignTraits> = Object.fromEntries(
  DESIGNS.map((d) => [
    d.id,
    d.id in CRAFTED_TRAITS
      ? CRAFTED_TRAITS[d.id as TemplateId]
      : {
          family: d.columns > 1 ? 'sidebar' : 'single',
          bold: d.family === 'bold' || d.family === 'portrait',
          timeline: d.family === 'timeline',
          photo: d.photo,
          fit: d.fit,
        },
  ]),
) as Record<DesignId, DesignTraits>;

export type ContentStats = {
  presetId: PresetId;
  words: number;
  bullets: number;
  jobs: number;
  /** Roughly how many A4 pages the content fills in a balanced single-column design. */
  pages: number;
  hasPhoto: boolean;
};

const WORDS_PER_PAGE = 420;

export function contentStats(
  doc: ResumeDocument,
  presetId: PresetId,
  hasPhoto: boolean,
): ContentStats {
  let words = 0;
  let bullets = 0;
  let jobs = 0;
  const count = (s: string) => (s.match(/\S+/g) ?? []).length;
  words += count(doc.basics.summary) + count(doc.basics.headline);
  for (const s of doc.sections) {
    if (s.hidden) continue;
    for (const it of s.items as Record<string, unknown>[]) {
      if (s.kind === 'experience' || s.kind === 'volunteering') jobs++;
      for (const v of Object.values(it)) {
        if (typeof v === 'string') words += count(v);
        else if (Array.isArray(v))
          for (const x of v) {
            if (typeof x !== 'string') continue;
            words += count(x);
            if (s.kind !== 'skills') bullets++;
          }
      }
    }
  }
  return {
    presetId,
    words,
    bullets,
    jobs,
    pages: Math.max(1, Math.round((words / WORDS_PER_PAGE) * 10) / 10),
    hasPhoto: hasPhoto || !!doc.basics.photo,
  };
}

export type Ranked = { id: DesignId; score: number; reasons: string[] };

export function scoreDesign(id: DesignId, s: ContentStats): Ranked {
  const t = DESIGN_TRAITS[id];
  const reasons: string[] = [];
  const fit = t.fit[s.presetId] ?? 0.4;
  const profession = Math.round(fit * 40);
  if (fit >= 0.8) reasons.push('suits your kind of work');

  let length: number;
  if (s.pages <= 1.2) length = t.family === 'sidebar' ? 20 : 12;
  else if (s.pages >= 2.5) length = t.family === 'single' ? 20 : 8;
  else length = 14;
  if (s.pages >= 2.5 && t.timeline) length = 20;
  if (length === 20)
    reasons.push(s.pages <= 1.2 ? 'fills one page well' : 'keeps a long CV easy to read');

  let photo: number;
  if (s.hasPhoto) photo = t.photo ? 15 : 0;
  else photo = t.photo ? 8 : 12;
  if (s.hasPhoto && t.photo) reasons.push('has room for your photo');

  const perJob = s.jobs ? s.bullets / s.jobs : 0;
  let density = 10;
  if (perJob > 6 || s.words > 900) density = t.family === 'single' && !t.bold ? 15 : 8;
  else if (s.words < 260) density = t.bold ? 15 : 9;
  if (density === 15)
    reasons.push(s.words < 260 ? 'a strong header for a short CV' : 'fits a lot of detail');

  return { id, score: profession + length + photo + density, reasons };
}

/**
 * Top `count` designs, best first. The strip always includes a single-column, a side-column and a
 * bold design, so the choice is visibly different.
 */
export function rankDesigns(s: ContentStats, enabled: DesignId[], count = 6): Ranked[] {
  const all = enabled
    .map((id) => scoreDesign(id, s))
    .sort((a, b) => b.score - a.score || enabled.indexOf(a.id) - enabled.indexOf(b.id));
  const pick = all.slice(0, count);
  const rules: ((t: DesignTraits) => boolean)[] = [
    (t) => t.family === 'single',
    (t) => t.family === 'sidebar',
    (t) => t.bold,
  ];
  for (const rule of rules) {
    if (pick.some((r) => rule(DESIGN_TRAITS[r.id]))) continue;
    const add = all.find((r) => !pick.includes(r) && rule(DESIGN_TRAITS[r.id]));
    if (!add) continue;
    // Replace the lowest-ranked pick that isn't needed for another rule.
    for (let i = pick.length - 1; i > 0; i--) {
      const t = DESIGN_TRAITS[pick[i]!.id];
      const needed = rules.some(
        (r) => r !== rule && r(t) && pick.filter((p) => r(DESIGN_TRAITS[p.id])).length === 1,
      );
      if (!needed) {
        pick[i] = add;
        break;
      }
    }
  }
  return pick.sort((a, b) => b.score - a.score);
}
