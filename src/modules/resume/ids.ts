/** Design identifiers shared by the document schema and the design engine (no imports: avoids cycles). */
export const TEMPLATE_IDS = [
  'clarity',
  'meridian',
  'heritage',
  'atelier',
  'ledger',
  'chronicle',
  'vivid',
  'folio',
  'halo',
  'sprout',
] as const;
export const FONT_PAIR_IDS = ['modern', 'classic', 'humanist', 'executive', 'technical'] as const;
export const DENSITIES = ['compact', 'balanced', 'airy'] as const;
export const PAGE_SIZES = ['A4', 'Letter'] as const;
