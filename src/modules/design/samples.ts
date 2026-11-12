import {
  BACKGROUNDS,
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
  LAYOUTS,
  MARKERS,
  SIDE_FILLS,
  SIZES,
  SKILL_STYLES,
  parseSpec,
  type DesignSpecV2,
} from './spec';
import { FONT_PAIR_IDS, PAGE_SIZES } from '@/modules/resume/ids';

/**
 * Test specs: a seeded random generator (property tests) and an "enum sweep" with one spec per
 * value of every field, so each value is rendered by the parity suite (spec §7.8).
 */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSpec(r: () => number): DesignSpecV2 {
  const one = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const num = (min: number, max: number) => +(min + r() * (max - min)).toFixed(1);
  const some = <T>(a: readonly T[]) => a.filter(() => r() < 0.5);
  return parseSpec({
    page: { size: one(PAGE_SIZES), marginMm: num(8, 24), background: one(BACKGROUNDS) },
    layout: {
      type: one(LAYOUTS),
      sideWidthPct: num(15, 45),
      gapMm: num(3, 11),
      sideFill: one(SIDE_FILLS),
      sideBleed: r() < 0.5,
      continuation: r() < 0.5 ? 'full-width' : 'keep-columns',
    },
    placement: {
      side: some(COMPACT_KINDS),
      third: some(COMPACT_KINDS),
      contactIn: r() < 0.3 ? 'side' : 'header',
    },
    header: {
      style: one(HEADER_STYLES),
      band: one(BANDS),
      align: r() < 0.3 ? 'center' : 'left',
      name: {
        size: one(SIZES),
        case: one(CASES),
        weight: one([400, 600, 700, 800] as const),
        twoTone: r() < 0.3,
        trackingEm: num(-0.05, 0.35),
      },
      headline: one(['below', 'beside', 'hidden'] as const),
      contact: { layout: one(['inline', 'stacked', 'grid-2'] as const), icons: r() < 0.6 },
      photo: {
        show: r() < 0.7,
        shape: one(['circle', 'rounded', 'square'] as const),
        size: one(['S', 'M', 'L'] as const),
        position: one(['header-left', 'header-right', 'side-top', 'overlap'] as const),
        ring: r() < 0.4,
      },
    },
    headings: {
      style: one(HEADING_STYLES),
      case: one(CASES),
      size: one(['S', 'M', 'L'] as const),
      weight: one([500, 600, 700] as const),
      color: r() < 0.5 ? 'accent' : 'ink',
    },
    sections: { container: one(CONTAINERS), divider: one(DIVIDERS) },
    entries: {
      layout: one(ENTRY_LAYOUTS),
      lead: r() < 0.5 ? 'role' : 'organisation',
      dateFormat: one(DATE_FORMATS),
    },
    bullets: { marker: one(MARKERS), color: r() < 0.5 ? 'accent' : 'ink' },
    lists: {
      skills: { style: one(SKILL_STYLES), columns: one([1, 2, 3, 4] as const) },
      languages: { style: one(['text', 'bars', 'dots'] as const) },
      compactColumns: one([1, 2, 3] as const),
    },
    color: {
      accent: `#${Math.floor(r() * 0xffffff)
        .toString(16)
        .padStart(6, '0')}`,
      secondary:
        r() < 0.5
          ? `#${Math.floor(r() * 0xffffff)
              .toString(16)
              .padStart(6, '0')}`
          : undefined,
      mode: one(COLOR_MODES),
      ink: one(INKS),
    },
    type: { pair: one(FONT_PAIR_IDS), basePt: num(9, 13), lineHeight: num(1.2, 1.7) },
    spacing: {
      density: one(['compact', 'balanced', 'airy'] as const),
      sectionGapPt: num(5, 30),
      itemGapPt: num(2, 20),
    },
    decor: { kind: one(DECOR_KINDS), intensity: r() < 0.5 ? 'subtle' : 'medium' },
    icons: { sections: r() < 0.4, style: r() < 0.5 ? 'line' : 'solid' },
    furniture: {
      pageNumbers: r() < 0.8,
      runningHeader: r() < 0.8,
      footer: one(['none', 'name', 'contact'] as const),
    },
    extras: { qr: one(['none', 'portfolio', 'linkedin'] as const), referencesLine: r() < 0.3 },
    atsSafe: r() < 0.1,
  });
}

/** One spec per enum value (plus layouts paired with side content). */
export function enumSweep(): { label: string; spec: DesignSpecV2 }[] {
  const out: { label: string; spec: DesignSpecV2 }[] = [];
  const add = (label: string, patch: object) => out.push({ label, spec: parseSpec(patch) });
  const side = { side: ['skills', 'languages'], third: ['certifications', 'licences', 'awards'] };
  for (const v of LAYOUTS) add(`layout ${v}`, { layout: { type: v }, placement: side });
  for (const v of SIDE_FILLS)
    add(`fill ${v}`, {
      layout: { type: 'sidebar-left', sideFill: v, sideBleed: true },
      placement: side,
    });
  for (const v of HEADER_STYLES)
    add(`header ${v}`, { header: { style: v }, layout: { type: 'sidebar-left' }, placement: side });
  for (const v of BANDS)
    add(`band ${v}`, { header: { style: 'band', band: v, photo: { position: 'overlap' } } });
  for (const v of SIZES) add(`name ${v}`, { header: { name: { size: v, twoTone: true } } });
  for (const v of CASES) add(`case ${v}`, { header: { name: { case: v } }, headings: { case: v } });
  for (const v of HEADING_STYLES) add(`heading ${v}`, { headings: { style: v } });
  for (const v of CONTAINERS) add(`container ${v}`, { sections: { container: v } });
  for (const v of DIVIDERS) add(`divider ${v}`, { sections: { divider: v } });
  for (const v of ENTRY_LAYOUTS)
    add(`entry ${v}`, { entries: { layout: v, lead: 'organisation' } });
  for (const v of DATE_FORMATS) add(`date ${v}`, { entries: { dateFormat: v } });
  for (const v of MARKERS) add(`marker ${v}`, { bullets: { marker: v } });
  for (const v of SKILL_STYLES) add(`skills ${v}`, { lists: { skills: { style: v, columns: 3 } } });
  for (const v of COLOR_MODES) add(`colour ${v}`, { color: { mode: v, secondary: '#9a4a12' } });
  for (const v of INKS) add(`ink ${v}`, { color: { ink: v } });
  for (const v of BACKGROUNDS) add(`page ${v}`, { page: { background: v } });
  for (const v of DECOR_KINDS) add(`decor ${v}`, { decor: { kind: v, intensity: 'medium' } });
  for (const v of ['header-left', 'header-right', 'side-top', 'overlap'] as const)
    add(`photo ${v}`, {
      header: { photo: { position: v, ring: true } },
      layout: { type: 'sidebar-right' },
      placement: side,
    });
  for (const v of ['inline', 'stacked', 'grid-2'] as const)
    add(`contact ${v}`, { header: { contact: { layout: v } } });
  for (const v of ['none', 'name', 'contact'] as const)
    add(`footer ${v}`, { furniture: { footer: v } });
  for (const v of ['portfolio', 'linkedin'] as const)
    add(`qr ${v}`, { extras: { qr: v, referencesLine: true } });
  add('contact in side', {
    layout: { type: 'sidebar-left' },
    placement: { ...side, contactIn: 'side' },
  });
  add('keep columns', {
    layout: { type: 'sidebar-right', continuation: 'keep-columns' },
    placement: side,
  });
  add('section icons', { icons: { sections: true, style: 'solid' } });
  add('ats safe', { atsSafe: true, layout: { type: 'rails' }, placement: side });
  for (const v of FONT_PAIR_IDS) add(`font ${v}`, { type: { pair: v } });
  return out;
}
