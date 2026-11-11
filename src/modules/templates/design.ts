import type {
  Density,
  DesignSpec,
  FontPairId,
  PageSize,
  TemplateId,
} from '@/modules/resume/schema';
import { ensureContrast, mix } from './color';
import { FONT_PAIRS, type FontPair } from './fonts';

export const PAGE_DIMENSIONS: Record<
  PageSize,
  { widthMm: number; heightMm: number; widthPx: number; heightPx: number }
> = {
  A4: { widthMm: 210, heightMm: 297, widthPx: 793.7, heightPx: 1122.5 },
  Letter: { widthMm: 215.9, heightMm: 279.4, widthPx: 816, heightPx: 1056 },
};

type DensityScale = {
  bodyPt: number;
  lineHeight: number;
  marginMm: number;
  sectionGapPt: number;
  itemGapPt: number;
};

export const DENSITY: Record<Density, DensityScale> = {
  compact: { bodyPt: 9.8, lineHeight: 1.36, marginMm: 13, sectionGapPt: 11, itemGapPt: 7 },
  balanced: { bodyPt: 10.5, lineHeight: 1.42, marginMm: 16, sectionGapPt: 15, itemGapPt: 9.5 },
  airy: { bodyPt: 11, lineHeight: 1.5, marginMm: 19, sectionGapPt: 19, itemGapPt: 12 },
};

/** Curated accent palette offered in the Design panel (all ≥ 4.5:1 on white). */
export const ACCENT_PALETTE = [
  { name: 'Navy', hex: '#1f3a5f' },
  { name: 'Blue', hex: '#1f4e8c' },
  { name: 'Teal', hex: '#1e6a6a' },
  { name: 'Green', hex: '#2d6a3e' },
  { name: 'Plum', hex: '#5b2a6e' },
  { name: 'Berry', hex: '#7a2e4d' },
  { name: 'Rust', hex: '#9a4a12' },
  { name: 'Bronze', hex: '#7a5a2e' },
  { name: 'Graphite', hex: '#33383f' },
] as const;

export type ResolvedDesign = {
  templateId: TemplateId;
  pageSize: PageSize;
  page: (typeof PAGE_DIMENSIONS)[PageSize];
  accent: string;
  accentSoft: string;
  accentTint: string;
  accentLine: string;
  /** Deeper shade for large colour areas (sidebars, bands). */
  accentDeep: string;
  /** Light tint readable on dark accent areas. */
  accentBright: string;
  font: FontPair;
  fontPairId: FontPairId;
  density: DensityScale;
  headerAlign: 'left' | 'center';
  skillStyle: 'tags' | 'inline';
};

export type TemplateOptionSupport = {
  headerAlign: ('left' | 'center')[];
  skillStyle: ('tags' | 'inline')[];
  defaults: {
    headerAlign: 'left' | 'center';
    skillStyle: 'tags' | 'inline';
    /** Font pair applied when the user picks this design (they can change it afterwards). */
    fontPair?: FontPairId;
  };
};

/** Resolve a user/AI design spec into concrete, safe values for a template. */
export function resolveDesign(spec: DesignSpec, support: TemplateOptionSupport): ResolvedDesign {
  const accent = ensureContrast(spec.accent, '#ffffff', 4.5);
  const pick = <T extends string>(value: T | undefined, allowed: T[], fallback: T): T =>
    value && allowed.includes(value) ? value : fallback;
  return {
    templateId: spec.templateId,
    pageSize: spec.pageSize,
    page: PAGE_DIMENSIONS[spec.pageSize],
    accent,
    accentSoft: mix(accent, '#ffffff', 0.9),
    accentTint: mix(accent, '#ffffff', 0.955),
    accentLine: mix(accent, '#ffffff', 0.6),
    accentDeep: mix(accent, '#000000', 0.22),
    accentBright: mix(accent, '#ffffff', 0.72),
    font: FONT_PAIRS[spec.fontPair],
    fontPairId: spec.fontPair,
    density: DENSITY[spec.density],
    headerAlign: pick(spec.options?.headerAlign, support.headerAlign, support.defaults.headerAlign),
    skillStyle: pick(spec.options?.skillStyle, support.skillStyle, support.defaults.skillStyle),
  };
}

/** CSS custom properties consumed by every template stylesheet. */
export function designCssVars(d: ResolvedDesign): string {
  const f = d.font;
  const body = +(d.density.bodyPt * f.bodyScale).toFixed(2);
  return `:root{
--page-w:${d.page.widthMm}mm;--page-h:${d.page.heightMm}mm;--margin:${d.density.marginMm}mm;
--accent:${d.accent};--accent-soft:${d.accentSoft};--accent-tint:${d.accentTint};--accent-line:${d.accentLine};--accent-deep:${d.accentDeep};--accent-bright:${d.accentBright};
--ink:#1b1e23;--ink-2:#41464e;--ink-3:#686e77;--rule:#d9dce1;
--font-heading:'${f.heading}',${f.headingFallback};--font-body:'${f.body}',${f.bodyFallback};--heading-weight:${f.headingWeight};
--fs:${body}pt;--lh:${d.density.lineHeight};--section-gap:${d.density.sectionGapPt}pt;--item-gap:${d.density.itemGapPt}pt;
}`;
}
