/**
 * Static CV font files (copied into public/fonts/cv by `npm run fonts:sync`).
 * Static weights on purpose: Chrome embeds variable fonts in PDFs as Type 3 glyphs.
 */
export type CatalogEntry = { slug: string; pkg: string; normal: number[]; italic: number[] };

export const FONT_CATALOG: Record<string, CatalogEntry> = {
  Inter: {
    slug: 'inter',
    pkg: '@fontsource/inter',
    normal: [400, 500, 600, 700, 800],
    italic: [400],
  },
  'Inter Tight': {
    slug: 'inter-tight',
    pkg: '@fontsource/inter-tight',
    normal: [500, 600, 700, 800],
    italic: [],
  },
  'Source Serif 4': {
    slug: 'source-serif-4',
    pkg: '@fontsource/source-serif-4',
    normal: [400, 600, 700],
    italic: [400, 600],
  },
  'Source Sans 3': {
    slug: 'source-sans-3',
    pkg: '@fontsource/source-sans-3',
    normal: [400, 600, 700],
    italic: [400],
  },
  Lora: {
    slug: 'lora',
    pkg: '@fontsource/lora',
    normal: [400, 600, 700],
    italic: [400],
  },
  'Cormorant Garamond': {
    slug: 'cormorant-garamond',
    pkg: '@fontsource/cormorant-garamond',
    normal: [500, 600, 700],
    italic: [500],
  },
  'IBM Plex Sans': {
    slug: 'ibm-plex-sans',
    pkg: '@fontsource/ibm-plex-sans',
    normal: [400, 500, 600, 700],
    italic: [400],
  },
  'Nunito Sans': {
    slug: 'nunito-sans',
    pkg: '@fontsource/nunito-sans',
    normal: [400, 600, 700, 800],
    italic: [400],
  },
};
