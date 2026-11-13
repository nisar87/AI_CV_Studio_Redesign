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
/** R7 catalogue designs that are pure Design Specs (no hand-written template code). */
export const SPEC_DESIGN_IDS = [
  'linea',
  'margin',
  'brief',
  'regent',
  'counsel',
  'scholar',
  'harbor',
  'summit',
  'column',
  'press',
  'milestone',
  'pathway',
  'route',
  'spark',
  'pulse',
  'lens',
  'cameo',
  'aura',
  'grid',
  'mosaic',
  'tiles',
  'matrix',
] as const;
/** Every catalogue design: the 10 hand-crafted ones, then the spec-only ones. */
export const DESIGN_IDS = [...TEMPLATE_IDS, ...SPEC_DESIGN_IDS] as const;
export const FONT_PAIR_IDS = ['modern', 'classic', 'humanist', 'executive', 'technical'] as const;
export const DENSITIES = ['compact', 'balanced', 'airy'] as const;
export const PAGE_SIZES = ['A4', 'Letter'] as const;
