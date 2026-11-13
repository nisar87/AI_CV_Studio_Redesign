import type { PresetId } from '@/modules/resume/professions';
import { DESIGN_IDS, SPEC_DESIGN_IDS } from '@/modules/resume/ids';
import type { DesignId, FontPairId, SpecDesignId, TemplateId } from '@/modules/resume/schema';
import type { DesignSpecV2Input } from './spec';

/**
 * The R7 catalogue (complete-studio-spec §8.1): 32 designs in 8 families of 4. The 10 hand-crafted
 * designs keep their signature code; the 22 others are pure Design Specs rendered by the composer.
 * Designs in a family differ in something visible at thumbnail size (layout, header, headings or
 * decoration), never only in colour. Colour and font stay the person's choice on top.
 */
export const FAMILIES = [
  'clean',
  'classic',
  'sidebar',
  'editorial',
  'timeline',
  'bold',
  'portrait',
  'compact',
] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABEL: Record<Family, { name: string; hint: string }> = {
  clean: { name: 'Clean', hint: 'Any role; safest for online applications' },
  classic: { name: 'Classic', hint: 'Law, finance, academia and senior roles' },
  sidebar: { name: 'Sidebar', hint: 'Creative, marketing and customer-facing roles' },
  editorial: { name: 'Editorial', hint: 'Tech, design and consulting' },
  timeline: { name: 'Timeline', hint: 'Long histories, trades and operations' },
  bold: { name: 'Bold', hint: 'Early career, sales and hospitality' },
  portrait: { name: 'Portrait', hint: 'Where a photo is expected' },
  compact: { name: 'Compact grid', hint: 'One page with many short sections' },
};

export type DesignMeta = {
  id: DesignId;
  name: string;
  /** Short look label shown under the thumbnail. */
  style: string;
  description: string;
  family: Family;
  /** Number of text columns in the main layout (1, 2 or 3). */
  columns: 1 | 2 | 3;
  photo: boolean;
  /** Kind of work this design suits, 0–1 (missing = neutral). */
  fit: Partial<Record<PresetId, number>>;
  /** Font pair the design is shown with (the person can change it). */
  fontPair?: FontPairId;
};

const SIDE = ['skills', 'languages', 'certifications', 'licences', 'awards'] as const;

/** Specs of the spec-only designs. Everything not set takes the spec default. */
export const SPEC_DESIGNS: Record<SpecDesignId, DesignSpecV2Input> = {
  // ── Clean ────────────────────────────────────────────────────────────────
  linea: {
    header: {
      style: 'split',
      name: { size: 'L', weight: 600 },
      contact: { layout: 'stacked', icons: false },
    },
    headings: { style: 'underline', case: 'normal', size: 'M', weight: 600, color: 'ink' },
    entries: { layout: 'dates-left' },
    bullets: { marker: 'dash', color: 'ink' },
    lists: { skills: { style: 'inline' } },
    color: { ink: 'black' },
  },
  margin: {
    page: { marginMm: 18 },
    header: { style: 'plain', name: { size: 'XL', weight: 700, trackingEm: -0.01 } },
    headings: { style: 'overline', case: 'upper', size: 'S', weight: 700 },
    sections: { divider: 'space' },
    entries: { layout: 'stacked' },
    bullets: { marker: 'square' },
    lists: { skills: { style: 'inline' } },
    decor: { kind: 'top-bar' },
  },
  brief: {
    header: { style: 'plain', name: { size: 'M', weight: 700 }, contact: { icons: false } },
    headings: { style: 'plain', case: 'upper', size: 'S', weight: 700 },
    sections: { divider: 'line' },
    entries: { layout: 'dates-right' },
    lists: { skills: { style: 'inline' } },
    spacing: { density: 'compact', sectionGapPt: 11, itemGapPt: 7 },
    type: { basePt: 9.8, lineHeight: 1.36 },
    page: { marginMm: 14 },
  },
  // ── Classic ──────────────────────────────────────────────────────────────
  regent: {
    header: {
      style: 'centered',
      align: 'center',
      name: { size: 'L', case: 'upper', weight: 600, trackingEm: 0.06 },
      contact: { icons: false },
      photo: { show: false },
    },
    headings: { style: 'rule-after', case: 'small-caps', weight: 600, color: 'ink' },
    sections: { divider: 'none' },
    bullets: { marker: 'disc', color: 'ink' },
    lists: { skills: { style: 'inline' } },
    color: { mode: 'mono', ink: 'black' },
  },
  counsel: {
    header: {
      style: 'centered',
      align: 'center',
      name: { size: 'XL', case: 'small-caps', weight: 600 },
      contact: { icons: false },
      photo: { show: false },
    },
    headings: { style: 'underline', case: 'small-caps', weight: 600, color: 'ink' },
    entries: { layout: 'stacked' },
    bullets: { marker: 'disc', color: 'ink' },
    lists: { skills: { style: 'inline' } },
    decor: { kind: 'frame', intensity: 'subtle' },
    page: { marginMm: 20 },
  },
  scholar: {
    page: { background: 'cream' },
    header: {
      style: 'centered',
      align: 'center',
      name: { size: 'L', weight: 700 },
      contact: { icons: false },
      photo: { show: false },
    },
    headings: { style: 'overline', case: 'upper', size: 'S', weight: 600, color: 'accent' },
    entries: { layout: 'dates-left', dateFormat: 'YYYY' },
    bullets: { marker: 'dash', color: 'ink' },
    lists: { skills: { style: 'grouped-list' } },
    color: { ink: 'navy' },
  },
  // ── Sidebar ──────────────────────────────────────────────────────────────
  harbor: {
    layout: { type: 'sidebar-left', sideWidthPct: 30, sideFill: 'tint' },
    placement: { side: [...SIDE], contactIn: 'side' },
    header: { style: 'plain', name: { size: 'XL' }, contact: { layout: 'stacked' } },
    headings: { style: 'bar-left', case: 'upper', size: 'S' },
    lists: { skills: { style: 'tags' } },
  },
  summit: {
    layout: { type: 'sidebar-right', sideWidthPct: 30, sideFill: 'deep' },
    placement: { side: [...SIDE] },
    header: { style: 'band', band: 'solid', name: { size: 'XL', weight: 800 } },
    headings: { style: 'underline', case: 'upper', size: 'S' },
    bullets: { marker: 'chevron' },
    lists: { skills: { style: 'grouped-list' } },
  },
  // ── Editorial ────────────────────────────────────────────────────────────
  column: {
    layout: { type: 'label-column' },
    header: { style: 'split', name: { size: 'XL', weight: 400, trackingEm: -0.02 } },
    headings: { style: 'plain', case: 'upper', size: 'S', weight: 700, color: 'ink' },
    bullets: { marker: 'none' },
    lists: { skills: { style: 'inline' } },
    color: { ink: 'black' },
  },
  press: {
    layout: { type: 'label-column' },
    header: { style: 'plain', name: { size: 'XL', weight: 600 } },
    headings: { style: 'plain', case: 'small-caps', size: 'L', weight: 700, color: 'accent' },
    sections: { divider: 'line' },
    bullets: { marker: 'diamond' },
    lists: { skills: { style: 'inline' } },
  },
  // ── Timeline ─────────────────────────────────────────────────────────────
  milestone: {
    layout: { type: 'timeline' },
    header: { style: 'band', band: 'solid', name: { size: 'L' } },
    headings: { style: 'filled', case: 'upper', size: 'S' },
    entries: { layout: 'timeline-dots', dateFormat: 'YYYY' },
    lists: { skills: { style: 'inline' } },
  },
  pathway: {
    page: { background: 'cream' },
    layout: { type: 'timeline' },
    header: {
      style: 'centered',
      align: 'center',
      name: { size: 'L' },
      photo: { size: 'S', shape: 'circle' },
    },
    headings: { style: 'rule-after', case: 'upper', size: 'S' },
    entries: { layout: 'timeline-dots' },
    bullets: { marker: 'chevron' },
    lists: { skills: { style: 'inline' } },
  },
  route: {
    header: { style: 'split', name: { size: 'L' } },
    headings: { style: 'bar-left', case: 'upper', size: 'S' },
    entries: { layout: 'timeline-dots' },
    bullets: { marker: 'arrow' },
    lists: { skills: { style: 'tags' } },
    decor: { kind: 'side-stripe' },
  },
  // ── Bold ─────────────────────────────────────────────────────────────────
  spark: {
    header: { style: 'band', band: 'gradient', name: { size: 'XL', weight: 800 } },
    headings: { style: 'filled', case: 'upper', size: 'S' },
    bullets: { marker: 'arrow' },
    lists: { skills: { style: 'tags' } },
    decor: { kind: 'corner-shapes', intensity: 'medium' },
  },
  pulse: {
    header: { style: 'band', band: 'angled', name: { size: 'L', case: 'upper', weight: 800 } },
    headings: { style: 'boxed', case: 'upper', size: 'S' },
    sections: { container: 'card' },
    bullets: { marker: 'square' },
    lists: { skills: { style: 'tags' } },
    decor: { kind: 'dot-grid' },
  },
  // ── Portrait ─────────────────────────────────────────────────────────────
  lens: {
    header: {
      style: 'split',
      name: { size: 'XL' },
      photo: { show: true, shape: 'circle', size: 'L', position: 'header-left', ring: true },
    },
    headings: { style: 'underline', case: 'upper', size: 'S' },
    lists: { skills: { style: 'tags' } },
  },
  cameo: {
    layout: { type: 'sidebar-left', sideWidthPct: 30, sideFill: 'none' },
    placement: { side: [...SIDE], contactIn: 'side' },
    header: {
      style: 'plain',
      name: { size: 'XL', weight: 600 },
      contact: { layout: 'stacked' },
      photo: { show: true, shape: 'square', size: 'L', position: 'side-top' },
    },
    headings: { style: 'rule-after', case: 'upper', size: 'S' },
    lists: { skills: { style: 'grouped-list' } },
  },
  aura: {
    header: {
      style: 'band',
      band: 'solid',
      name: { size: 'XL' },
      photo: { show: true, shape: 'circle', size: 'L', position: 'header-right', ring: true },
    },
    headings: { style: 'plain', case: 'upper', size: 'S' },
    sections: { divider: 'accent-line' },
    lists: { skills: { style: 'tags' } },
  },
  // ── Compact grid ─────────────────────────────────────────────────────────
  grid: {
    layout: { type: 'two-equal', sideWidthPct: 40, sideFill: 'none' },
    placement: { side: [...SIDE] },
    header: { style: 'plain', name: { size: 'L' } },
    headings: { style: 'plain', case: 'upper', size: 'S' },
    sections: { container: 'card' },
    lists: { skills: { style: 'columns', columns: 2 } },
    spacing: { density: 'compact', sectionGapPt: 10, itemGapPt: 7 },
    type: { basePt: 9.8, lineHeight: 1.36 },
    page: { marginMm: 13 },
  },
  mosaic: {
    layout: { type: 'rails', sideWidthPct: 24, sideFill: 'none' },
    placement: { side: ['languages', 'certifications', 'licences'], third: ['skills', 'awards'] },
    header: { style: 'plain', name: { size: 'L' } },
    headings: { style: 'plain', case: 'upper', size: 'S' },
    sections: { container: 'outlined' },
    lists: { skills: { style: 'tags' } },
    spacing: { density: 'compact', sectionGapPt: 10, itemGapPt: 7 },
    type: { basePt: 9.6, lineHeight: 1.36 },
    page: { marginMm: 12 },
  },
  tiles: {
    layout: { type: 'two-equal', sideWidthPct: 40, sideFill: 'none' },
    placement: { side: [...SIDE] },
    header: { style: 'card', name: { size: 'L' } },
    headings: { style: 'filled', case: 'upper', size: 'S' },
    sections: { container: 'tinted-heading' },
    lists: { skills: { style: 'tags' } },
    spacing: { density: 'compact', sectionGapPt: 10, itemGapPt: 7 },
    type: { basePt: 9.8, lineHeight: 1.36 },
    page: { marginMm: 13 },
  },
  matrix: {
    layout: { type: 'rails', sideWidthPct: 24, sideFill: 'none' },
    placement: { side: ['languages', 'certifications', 'licences'], third: ['skills', 'awards'] },
    header: { style: 'band', band: 'solid', name: { size: 'L', weight: 800 } },
    headings: { style: 'rule-after', case: 'upper', size: 'S' },
    sections: { divider: 'line' },
    lists: { skills: { style: 'inline' } },
    spacing: { density: 'compact', sectionGapPt: 10, itemGapPt: 7 },
    type: { basePt: 9.6, lineHeight: 1.36 },
    page: { marginMm: 12 },
  },
};

const M = (
  id: DesignId,
  family: Family,
  name: string,
  style: string,
  description: string,
  o: Partial<Pick<DesignMeta, 'columns' | 'photo' | 'fit' | 'fontPair'>> = {},
): DesignMeta => ({
  id,
  name,
  style,
  description,
  family,
  columns: o.columns ?? 1,
  photo: o.photo ?? true,
  fit: o.fit ?? {},
  ...(o.fontPair ? { fontPair: o.fontPair } : {}),
});

/** Every catalogue design, in gallery order (by family, safest first). */
export const DESIGNS: DesignMeta[] = [
  M(
    'clarity',
    'clean',
    'Clarity',
    'Modern & clear',
    'Single column with a clean accent line. Calm, clear and easy for anyone to read.',
    {
      fit: { general: 1, office: 0.9, tech: 0.8, driver: 0.8, trades: 0.7, retail: 0.6 },
    },
  ),
  M(
    'linea',
    'clean',
    'Linea',
    'Quiet & precise',
    'Name left, contact right, dates in a margin and plain black type. Nothing to distract.',
    {
      photo: false,
      fit: { tech: 0.9, office: 0.9, general: 0.8, executive: 0.6 },
    },
  ),
  M(
    'margin',
    'clean',
    'Margin',
    'Airy & modern',
    'A large name, a thin accent bar and generous white space. Reads well on screen and paper.',
    {
      fit: { office: 0.8, general: 0.8, teacher: 0.7, student: 0.6 },
    },
  ),
  M(
    'brief',
    'clean',
    'Brief',
    'Compact & tidy',
    'Tighter spacing and thin lines between sections, for a lot of detail on one page.',
    {
      photo: false,
      fit: { tech: 0.8, trades: 0.8, driver: 0.8, general: 0.7, healthcare: 0.6 },
    },
  ),
  M(
    'heritage',
    'classic',
    'Heritage',
    'Calm & classic',
    'A monogram letterhead, small capitals and quiet rules. Traditional and trustworthy.',
    {
      photo: false,
      fit: { executive: 1, office: 0.7, teacher: 0.6, healthcare: 0.5 },
    },
  ),
  M(
    'regent',
    'classic',
    'Regent',
    'Formal & centred',
    'Centred letter-spaced name, black ink and small-capital headings. For formal applications.',
    {
      photo: false,
      fontPair: 'classic',
      fit: { executive: 0.9, office: 0.8, teacher: 0.6 },
    },
  ),
  M(
    'counsel',
    'classic',
    'Counsel',
    'Traditional & framed',
    'A large small-capital name, dates under each role and a fine page frame. Suits law and finance.',
    {
      photo: false,
      fontPair: 'executive',
      fit: { executive: 1, office: 0.7 },
    },
  ),
  M(
    'scholar',
    'classic',
    'Scholar',
    'Academic & warm',
    'Cream paper, years in a margin and a grouped skills list. Made for academic and teaching CVs.',
    {
      photo: false,
      fontPair: 'classic',
      fit: { teacher: 1, healthcare: 0.6, executive: 0.6 },
    },
  ),
  M(
    'atelier',
    'sidebar',
    'Atelier',
    'Creative sidebar',
    'A deep coloured sidebar with your name, photo and contact. Confident and creative.',
    {
      columns: 2,
      fontPair: 'modern',
      fit: { tech: 0.7, student: 0.7, retail: 0.6, office: 0.5 },
    },
  ),
  M(
    'meridian',
    'sidebar',
    'Meridian',
    'Bold & organised',
    'An angled colour band and a side column for skills. Organised and friendly.',
    {
      columns: 2,
      fit: { healthcare: 1, office: 0.8, retail: 0.7, general: 0.7, teacher: 0.6 },
    },
  ),
  M(
    'harbor',
    'sidebar',
    'Harbor',
    'Soft sidebar',
    'A light side column on the left with contact, skills and languages; headings with a colour bar.',
    {
      columns: 2,
      fit: { office: 0.8, retail: 0.8, healthcare: 0.7, general: 0.7 },
    },
  ),
  M(
    'summit',
    'sidebar',
    'Summit',
    'Strong sidebar',
    'A colour band across the top and a deep colour side column on the right.',
    {
      columns: 2,
      fit: { retail: 0.8, student: 0.7, office: 0.6, tech: 0.6 },
    },
  ),
  M(
    'ledger',
    'editorial',
    'Ledger',
    'Bold editorial',
    'Numbered section names in a margin and a large name. Striking without colour.',
    {
      fontPair: 'modern',
      fit: { tech: 1, executive: 0.7, office: 0.6 },
    },
  ),
  M(
    'folio',
    'editorial',
    'Folio',
    'Editorial',
    'A two-tone name and a light side column, like a magazine page.',
    {
      columns: 2,
      fontPair: 'classic',
      fit: { executive: 0.8, office: 0.6, teacher: 0.6, tech: 0.5 },
    },
  ),
  M(
    'column',
    'editorial',
    'Column',
    'Minimal editorial',
    'Section names in a left margin, a light oversized name and no bullets. Clean and modern.',
    {
      photo: false,
      fit: { tech: 0.9, office: 0.7, executive: 0.6 },
    },
  ),
  M(
    'press',
    'editorial',
    'Press',
    'Refined editorial',
    'Small-capital section names in a margin, fine rules and diamond bullets.',
    {
      fontPair: 'executive',
      fit: { executive: 0.8, office: 0.7, tech: 0.6, teacher: 0.6 },
    },
  ),
  M(
    'chronicle',
    'timeline',
    'Chronicle',
    'Timeline',
    'Your dates on a line down the page. Your path at a glance.',
    {
      fontPair: 'classic',
      fit: { trades: 1, driver: 1, healthcare: 0.6, executive: 0.6, office: 0.5 },
    },
  ),
  M(
    'milestone',
    'timeline',
    'Milestone',
    'Timeline with banner',
    'A colour banner and a timeline of years. Long careers read in seconds.',
    {
      fit: { trades: 0.9, driver: 0.9, executive: 0.7, office: 0.6 },
    },
  ),
  M(
    'pathway',
    'timeline',
    'Pathway',
    'Warm timeline',
    'Cream paper, a centred name and a dotted timeline. Calm and personal.',
    {
      fit: { healthcare: 0.8, teacher: 0.8, trades: 0.7, general: 0.6 },
    },
  ),
  M(
    'route',
    'timeline',
    'Route',
    'Timeline with stripe',
    'A colour stripe down the edge and timeline dots for each job.',
    {
      fit: { driver: 1, trades: 0.9, retail: 0.6, general: 0.6 },
    },
  ),
  M(
    'vivid',
    'bold',
    'Vivid',
    'Bold & modern',
    'A gradient band with an overlapping portrait. Modern and memorable.',
    {
      columns: 2,
      fontPair: 'modern',
      fit: { student: 1, retail: 0.9, tech: 0.5 },
    },
  ),
  M(
    'sprout',
    'bold',
    'Sprout',
    'Friendly & fresh',
    'Rounded cards, ticks and a soft side panel. Friendly and fresh.',
    {
      columns: 2,
      fontPair: 'humanist',
      fit: { student: 0.9, retail: 0.8, healthcare: 0.6, teacher: 0.6 },
    },
  ),
  M(
    'spark',
    'bold',
    'Spark',
    'Energetic',
    'A gradient banner, filled headings and geometric corners. Full of energy.',
    {
      fit: { student: 0.9, retail: 0.9, general: 0.5 },
    },
  ),
  M(
    'pulse',
    'bold',
    'Pulse',
    'Bold cards',
    'An angled banner, capital name and sections in soft cards.',
    {
      fit: { retail: 0.9, student: 0.8, general: 0.6 },
    },
  ),
  M(
    'halo',
    'portrait',
    'Halo',
    'Warm portrait',
    'A centred name with a ringed photo and a soft side column. Warm and personal.',
    {
      columns: 2,
      fontPair: 'humanist',
      fit: { healthcare: 0.8, teacher: 0.8, retail: 0.6 },
    },
  ),
  M(
    'lens',
    'portrait',
    'Lens',
    'Photo first',
    'A large ringed photo beside your name, single column below.',
    {
      fit: { retail: 0.8, healthcare: 0.7, teacher: 0.7, general: 0.6 },
    },
  ),
  M(
    'cameo',
    'portrait',
    'Cameo',
    'Photo sidebar',
    'A square photo heads a clean side column with your contact and skills.',
    {
      columns: 2,
      fit: { office: 0.7, retail: 0.7, healthcare: 0.6, teacher: 0.6 },
    },
  ),
  M(
    'aura',
    'portrait',
    'Aura',
    'Portrait banner',
    'A colour banner with a large ringed photo beside your name.',
    {
      fit: { retail: 0.8, student: 0.8, healthcare: 0.6 },
    },
  ),
  M(
    'grid',
    'compact',
    'Grid',
    'Two-column cards',
    'Two equal columns of soft cards: experience left, short sections right.',
    {
      columns: 2,
      photo: false,
      fit: { tech: 0.8, student: 0.8, general: 0.6 },
    },
  ),
  M(
    'mosaic',
    'compact',
    'Mosaic',
    'Three-column grid',
    'Three columns with outlined sections: skills and awards on the right.',
    {
      columns: 3,
      photo: false,
      fit: { tech: 0.9, student: 0.7 },
    },
  ),
  M(
    'tiles',
    'compact',
    'Tiles',
    'Coloured tiles',
    'Two columns of sections with coloured heading strips.',
    {
      columns: 2,
      photo: false,
      fit: { student: 0.9, retail: 0.6, general: 0.6 },
    },
  ),
  M(
    'matrix',
    'compact',
    'Matrix',
    'Three-column banner',
    'A colour banner over three columns of cards. A lot fits on one page.',
    {
      columns: 3,
      photo: false,
      fit: { tech: 0.9, office: 0.6, student: 0.6 },
    },
  ),
];

export const DESIGN_META: Record<DesignId, DesignMeta> = Object.fromEntries(
  DESIGNS.map((d) => [d.id, d]),
) as Record<DesignId, DesignMeta>;

export const isSpecDesign = (id: string): id is SpecDesignId =>
  (SPEC_DESIGN_IDS as readonly string[]).includes(id);
export const isDesignId = (id: string): id is DesignId =>
  (DESIGN_IDS as readonly string[]).includes(id);
export const isLegacy = (id: DesignId): id is TemplateId => !isSpecDesign(id);

/**
 * v1 `templateId` a spec-only design is stored with (Word export, letters and the portfolio still
 * read the v1 fields): the hand-crafted design of the same family that is closest in spirit.
 */
export const LEGACY_FALLBACK: Record<SpecDesignId, TemplateId> = {
  linea: 'clarity',
  margin: 'clarity',
  brief: 'clarity',
  regent: 'heritage',
  counsel: 'heritage',
  scholar: 'heritage',
  harbor: 'atelier',
  summit: 'meridian',
  column: 'ledger',
  press: 'ledger',
  milestone: 'chronicle',
  pathway: 'chronicle',
  route: 'chronicle',
  spark: 'vivid',
  pulse: 'vivid',
  lens: 'halo',
  cameo: 'halo',
  aura: 'halo',
  grid: 'clarity',
  mosaic: 'clarity',
  tiles: 'clarity',
  matrix: 'clarity',
};
