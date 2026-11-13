import { DENSITIES, DESIGN_IDS, FONT_PAIR_IDS } from '@/modules/resume/ids';
import {
  BANDS,
  CASES,
  COLOR_MODES,
  COMPACT_KINDS,
  CONTAINERS,
  DATE_FORMATS,
  DECOR_KINDS,
  DIVIDERS,
  ENTRY_LAYOUTS,
  HEADER_STYLES,
  HEADING_STYLES,
  INKS,
  BACKGROUNDS,
  LAYOUTS,
  MARKERS,
  SIDE_FILLS,
  SKILL_STYLES,
  parseSpec,
  type DesignSpecV2,
} from './spec';

/**
 * The design vocabulary as one flat list of named fields (complete-studio-spec §7.2). The AI
 * Designer reads and writes designs only through these names: `design.compose` returns flat
 * choices, `design.refine` returns a patch of { field, value }. Each field maps to one spec path,
 * so a patch can only ever change the paths it names. Flat and small, so the model's JSON schema
 * stays within what Gemini accepts.
 */
type Kind = 'enum' | 'color' | 'bool' | 'number' | 'kinds';
export type FieldDef = {
  path: string;
  kind: Kind;
  values?: readonly string[];
  min?: number;
  max?: number;
  /** What it means and the words people use (goes into the prompt). */
  say: string;
};

export const FIELDS = {
  layout: {
    path: 'layout.type',
    kind: 'enum',
    values: LAYOUTS,
    say: 'page layout. "2 column" → sidebar-left/right or two-equal; "3 column" → rails (narrow left + main + narrow right); "section names in a margin" → label-column; "dates down the side" → timeline',
  },
  sideWidth: {
    path: 'layout.sideWidthPct',
    kind: 'number',
    min: 20,
    max: 40,
    say: 'side column width in % (24–40; rails 20–27)',
  },
  sideFill: {
    path: 'layout.sideFill',
    kind: 'enum',
    values: SIDE_FILLS,
    say: 'side column colour: none, tint (light), solid (soft colour), deep ("dark sidebar")',
  },
  sideBleed: {
    path: 'layout.sideBleed',
    kind: 'bool',
    say: 'side column colour runs to the page edge',
  },
  keepColumns: {
    path: 'layout.continuation',
    kind: 'enum',
    values: ['full-width', 'keep-columns'],
    say: 'later pages: full-width, or keep-columns (side column on every page)',
  },
  sideSections: {
    path: 'placement.side',
    kind: 'kinds',
    values: COMPACT_KINDS,
    say: 'sections in the side column ("skills on the left")',
  },
  thirdSections: {
    path: 'placement.third',
    kind: 'kinds',
    values: COMPACT_KINDS,
    say: 'sections in the right rail (rails layout only)',
  },
  contactIn: {
    path: 'placement.contactIn',
    kind: 'enum',
    values: ['header', 'side'],
    say: 'contact details in the header or the side column',
  },
  header: {
    path: 'header.style',
    kind: 'enum',
    values: HEADER_STYLES,
    say: 'header: plain, centered, band ("coloured banner"), split (name left, contact right), card, monogram ("my initials in a circle"), in-sidebar',
  },
  band: {
    path: 'header.band',
    kind: 'enum',
    values: BANDS,
    say: 'banner style: solid, gradient, angled edge',
  },
  align: { path: 'header.align', kind: 'enum', values: ['left', 'center'], say: 'name position' },
  nameSize: {
    path: 'header.name.size',
    kind: 'enum',
    values: ['S', 'M', 'L', 'XL'],
    say: 'name size ("huge name" → XL)',
  },
  nameCase: {
    path: 'header.name.case',
    kind: 'enum',
    values: CASES,
    say: 'name in normal case, upper ("name in capitals") or small-caps',
  },
  nameTwoTone: { path: 'header.name.twoTone', kind: 'bool', say: 'surname in the accent colour' },
  nameSpacing: {
    path: 'header.name.trackingEm',
    kind: 'number',
    min: -0.02,
    max: 0.3,
    say: 'letter spacing of the name in em ("spaced-out letters" → 0.12)',
  },
  contactLayout: {
    path: 'header.contact.layout',
    kind: 'enum',
    values: ['inline', 'stacked', 'grid-2'],
    say: 'contact details in a row (inline), stacked, or in two columns',
  },
  contactIcons: { path: 'header.contact.icons', kind: 'bool', say: 'icons for phone, email…' },
  photo: { path: 'header.photo.show', kind: 'bool', say: 'show the photo ("no photo" → false)' },
  photoShape: {
    path: 'header.photo.shape',
    kind: 'enum',
    values: ['circle', 'rounded', 'square'],
    say: 'photo shape ("round photo" → circle)',
  },
  photoSize: {
    path: 'header.photo.size',
    kind: 'enum',
    values: ['S', 'M', 'L'],
    say: 'photo size',
  },
  photoPosition: {
    path: 'header.photo.position',
    kind: 'enum',
    values: ['header-left', 'header-right', 'side-top', 'overlap'],
    say: 'photo position ("photo top right" → header-right; overlap = on the edge of a banner)',
  },
  photoRing: { path: 'header.photo.ring', kind: 'bool', say: 'ring around the photo' },
  headings: {
    path: 'headings.style',
    kind: 'enum',
    values: HEADING_STYLES,
    say: 'section headings: plain, underline ("line under"), overline, rule-after (line to the right), bar-left, filled ("headings in coloured boxes"), boxed (outlined), numbered, icon',
  },
  headingCase: { path: 'headings.case', kind: 'enum', values: CASES, say: 'heading letters' },
  headingSize: {
    path: 'headings.size',
    kind: 'enum',
    values: ['S', 'M', 'L'],
    say: 'heading size',
  },
  headingColor: {
    path: 'headings.color',
    kind: 'enum',
    values: ['accent', 'ink'],
    say: 'headings in the accent colour or dark ink',
  },
  container: {
    path: 'sections.container',
    kind: 'enum',
    values: CONTAINERS,
    say: 'sections as none, card ("boxes", "card style"), outlined, tinted-heading',
  },
  divider: {
    path: 'sections.divider',
    kind: 'enum',
    values: DIVIDERS,
    say: 'between sections ("lines between sections" → line; "clean, no lines" → none)',
  },
  entries: {
    path: 'entries.layout',
    kind: 'enum',
    values: ENTRY_LAYOUTS,
    say: 'jobs: stacked, dates-right ("dates on the right"), dates-left, timeline-dots ("timeline")',
  },
  lead: {
    path: 'entries.lead',
    kind: 'enum',
    values: ['role', 'organisation'],
    say: 'job title first or employer first ("company name in bold")',
  },
  dateFormat: {
    path: 'entries.dateFormat',
    kind: 'enum',
    values: DATE_FORMATS,
    say: 'date format',
  },
  bullets: {
    path: 'bullets.marker',
    kind: 'enum',
    values: MARKERS,
    say: 'bullet marker ("arrows", "ticks" → check, "no bullets" → none)',
  },
  bulletColor: {
    path: 'bullets.color',
    kind: 'enum',
    values: ['accent', 'ink'],
    say: 'bullet colour',
  },
  skills: {
    path: 'lists.skills.style',
    kind: 'enum',
    values: SKILL_STYLES,
    say: 'skills as tags (pills), inline, columns ("skills in a grid"), grouped-list; bars/dots only exist when levels are set',
  },
  skillColumns: {
    path: 'lists.skills.columns',
    kind: 'number',
    min: 1,
    max: 4,
    say: 'columns of skills (with skills: columns)',
  },
  accent: {
    path: 'color.accent',
    kind: 'color',
    say: 'accent colour as #rrggbb ("navy" → #1f3a5f, "teal" → #1e6a6a)',
  },
  secondColor: {
    path: 'color.secondary',
    kind: 'color',
    say: 'second colour (only with colorMode duo, "navy and gold")',
  },
  colorMode: {
    path: 'color.mode',
    kind: 'enum',
    values: COLOR_MODES,
    say: 'mono ("black and white"), accent, duo (two colours)',
  },
  ink: { path: 'color.ink', kind: 'enum', values: INKS, say: 'body text colour' },
  paper: {
    path: 'page.background',
    kind: 'enum',
    values: BACKGROUNDS,
    say: 'paper: white, cream ("cream paper"), tint',
  },
  font: {
    path: 'type.pair',
    kind: 'enum',
    values: FONT_PAIR_IDS,
    say: 'fonts: modern (clean sans), classic (serif headings), humanist (friendly), executive (elegant serif), technical (precise)',
  },
  textSize: {
    path: 'type.basePt',
    kind: 'number',
    min: 9.5,
    max: 12,
    say: 'body text size in pt ("bigger text" → 11)',
  },
  spacing: {
    path: 'spacing.density',
    kind: 'enum',
    values: DENSITIES,
    say: 'compact ("fit on one page"), balanced, airy ("more white space")',
  },
  margin: {
    path: 'page.marginMm',
    kind: 'number',
    min: 10,
    max: 22,
    say: 'page margin in mm ("narrow margins" → 12)',
  },
  decor: {
    path: 'decor.kind',
    kind: 'enum',
    values: DECOR_KINDS,
    say: 'decoration: none ("minimal"), top-bar, side-stripe, corner-shapes ("geometric shapes"), frame ("a border"), dot-grid, watermark-initials',
  },
  decorStrength: {
    path: 'decor.intensity',
    kind: 'enum',
    values: ['subtle', 'medium'],
    say: 'decoration strength',
  },
  sectionIcons: { path: 'icons.sections', kind: 'bool', say: 'icons next to headings' },
  pageNumbers: { path: 'furniture.pageNumbers', kind: 'bool', say: 'page numbers ("page 1 of 2")' },
  runningHeader: { path: 'furniture.runningHeader', kind: 'bool', say: 'name on every later page' },
  qr: {
    path: 'extras.qr',
    kind: 'enum',
    values: ['none', 'portfolio', 'linkedin'],
    say: 'QR code to the portfolio or LinkedIn',
  },
  references: {
    path: 'extras.referencesLine',
    kind: 'bool',
    say: '"References available on request" line',
  },
} as const satisfies Record<string, FieldDef>;

export type FieldName = keyof typeof FIELDS;
export const FIELD_NAMES = Object.keys(FIELDS) as FieldName[];
/** Catalogue designs a composition may start from. */
export const START_IDS = DESIGN_IDS;

type Flat = Partial<Record<FieldName, string | number | boolean | string[]>>;

function getPath(o: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((x, k) => (x as Record<string, unknown> | undefined)?.[k], o);
}
function setPath(o: Record<string, unknown>, path: string, v: unknown) {
  const keys = path.split('.');
  let x = o;
  for (const k of keys.slice(0, -1)) {
    if (typeof x[k] !== 'object' || x[k] === null) x[k] = {};
    x = x[k] as Record<string, unknown>;
  }
  x[keys[keys.length - 1]!] = v;
}

/** A value the AI sent, coerced to its field's kind; undefined if it can't be used. */
export function coerce(name: FieldName, raw: unknown): unknown {
  const f: FieldDef = FIELDS[name];
  switch (f.kind) {
    case 'enum':
      return typeof raw === 'string' && f.values!.includes(raw) ? raw : undefined;
    case 'color':
      return typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : undefined;
    case 'bool':
      return typeof raw === 'boolean'
        ? raw
        : raw === 'true'
          ? true
          : raw === 'false'
            ? false
            : undefined;
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? Math.min(f.max!, Math.max(f.min!, n)) : undefined;
    }
    case 'kinds': {
      const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,\s]+/) : [];
      return [...new Set(list.filter((k): k is string => f.values!.includes(k as never)))];
    }
  }
}

/** The flat view of a spec. */
export function toFlat(spec: DesignSpecV2): Flat {
  const out: Flat = {};
  for (const n of FIELD_NAMES) {
    const v = getPath(spec, FIELDS[n].path);
    if (v !== undefined) out[n] = v as Flat[FieldName];
  }
  return out;
}

/**
 * Apply flat choices to a spec. Unknown fields and unusable values are skipped (and returned),
 * so nothing but a parsed spec ever comes out.
 */
export function applyFlat(
  spec: DesignSpecV2,
  flat: Record<string, unknown>,
): { spec: DesignSpecV2; applied: FieldName[]; skipped: string[] } {
  const next = structuredClone(spec) as unknown as Record<string, unknown>;
  const applied: FieldName[] = [];
  const skipped: string[] = [];
  for (const [k, raw] of Object.entries(flat)) {
    if (!(k in FIELDS)) {
      skipped.push(k);
      continue;
    }
    const v = coerce(k as FieldName, raw);
    if (v === undefined) {
      skipped.push(k);
      continue;
    }
    setPath(next, FIELDS[k as FieldName].path, v);
    applied.push(k as FieldName);
  }
  return { spec: parseSpec(next), applied, skipped };
}

/** The vocabulary in compact form for the prompt. */
export function vocabularyForPrompt(): string {
  return FIELD_NAMES.map((n) => {
    const f: FieldDef = FIELDS[n];
    const range =
      f.kind === 'enum' || f.kind === 'kinds'
        ? `${f.kind === 'kinds' ? 'list of ' : ''}${f.values!.join('|')}`
        : f.kind === 'number'
          ? `${f.min}–${f.max}`
          : f.kind === 'color'
            ? '#rrggbb'
            : 'true|false';
    return `- ${n} (${range}): ${f.say}`;
  }).join('\n');
}
