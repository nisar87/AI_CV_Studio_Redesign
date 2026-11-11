import type { FontPairId } from '@/modules/resume/schema';

/** Font catalogue for CV documents. Files live in public/fonts/cv (see scripts/sync-fonts.mjs). */

type Face = {
  family: string;
  file: string;
  weight: string;
  style: 'normal' | 'italic';
  subset: 'latin' | 'latin-ext';
};

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const VARIABLE: Record<string, { slug: string; weight: string }> = {
  Inter: { slug: 'inter', weight: '100 900' },
  'Inter Tight': { slug: 'inter-tight', weight: '100 900' },
  'Source Serif 4': { slug: 'source-serif-4', weight: '200 900' },
  'Source Sans 3': { slug: 'source-sans-3', weight: '200 900' },
  Lora: { slug: 'lora', weight: '400 700' },
  'Cormorant Garamond': { slug: 'cormorant-garamond', weight: '300 700' },
  'IBM Plex Sans': { slug: 'ibm-plex-sans', weight: '100 700' },
};

function facesFor(family: string): Face[] {
  const faces: Face[] = [];
  const subsets = ['latin', 'latin-ext'] as const;
  const styles = ['normal', 'italic'] as const;
  const v = VARIABLE[family];
  if (v) {
    for (const subset of subsets)
      for (const style of styles)
        faces.push({
          family,
          file: `${v.slug}-${subset}-wght-${style}.woff2`,
          weight: v.weight,
          style,
          subset,
        });
  } else if (family === 'Lato') {
    for (const subset of subsets)
      for (const w of ['400', '700'])
        for (const style of styles)
          faces.push({
            family,
            file: `lato-${subset}-${w}-${style}.woff2`,
            weight: w,
            style,
            subset,
          });
  }
  return faces;
}

export type FontPair = {
  id: FontPairId;
  label: string;
  heading: string;
  body: string;
  headingWeight: number;
  /** Visual size correction so different families feel the same size. */
  bodyScale: number;
  headingFallback: string;
  bodyFallback: string;
};

const SANS = "'Helvetica Neue', Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

export const FONT_PAIRS: Record<FontPairId, FontPair> = {
  modern: {
    id: 'modern',
    label: 'Modern',
    heading: 'Inter Tight',
    body: 'Inter',
    headingWeight: 700,
    bodyScale: 0.97,
    headingFallback: SANS,
    bodyFallback: SANS,
  },
  classic: {
    id: 'classic',
    label: 'Classic',
    heading: 'Source Serif 4',
    body: 'Source Sans 3',
    headingWeight: 650,
    bodyScale: 1.04,
    headingFallback: SERIF,
    bodyFallback: SANS,
  },
  humanist: {
    id: 'humanist',
    label: 'Warm',
    heading: 'Lora',
    body: 'Lato',
    headingWeight: 600,
    bodyScale: 1.0,
    headingFallback: SERIF,
    bodyFallback: SANS,
  },
  executive: {
    id: 'executive',
    label: 'Elegant',
    heading: 'Cormorant Garamond',
    body: 'Source Sans 3',
    headingWeight: 600,
    bodyScale: 1.04,
    headingFallback: SERIF,
    bodyFallback: SANS,
  },
  technical: {
    id: 'technical',
    label: 'Precise',
    heading: 'IBM Plex Sans',
    body: 'IBM Plex Sans',
    headingWeight: 600,
    bodyScale: 0.97,
    headingFallback: SANS,
    bodyFallback: SANS,
  },
};

export type FontSource =
  | { kind: 'url'; baseUrl: string }
  /** Returns base64 file contents (server-side PDF rendering: no network needed). */
  | { kind: 'inline'; read: (file: string) => string };

/** @font-face rules for one font pair. */
export function fontFaceCss(pairId: FontPairId, source: FontSource): string {
  const pair = FONT_PAIRS[pairId];
  const families = Array.from(new Set([pair.heading, pair.body]));
  return families
    .flatMap(facesFor)
    .map((f) => {
      const src =
        source.kind === 'url'
          ? `url('${source.baseUrl.replace(/\/$/, '')}/fonts/cv/${f.file}') format('woff2')`
          : `url(data:font/woff2;base64,${source.read(f.file)}) format('woff2')`;
      return `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};font-display:block;src:${src};unicode-range:${f.subset === 'latin' ? LATIN : LATIN_EXT};}`;
    })
    .join('\n');
}

export function fontFilesFor(pairId: FontPairId): string[] {
  const pair = FONT_PAIRS[pairId];
  return Array.from(new Set([pair.heading, pair.body]))
    .flatMap(facesFor)
    .map((f) => f.file);
}
