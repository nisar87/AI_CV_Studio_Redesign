import { PRESETS } from '@/modules/resume/presets';
import { PROFESSIONS, type PresetId } from '@/modules/resume/professions';
import type { FontPairId, TemplateId } from '@/modules/resume/schema';
import { ACCENT_PALETTE } from '@/modules/templates/design';

/**
 * What the AI may choose from, described in words. Kept separate from the template registry
 * (React components) so prompts and the mock stay light and client-safe.
 */
export const TEMPLATE_CATALOG: Record<
  TemplateId,
  { name: string; style: string; mood: string; photo: boolean; font: FontPairId }
> = {
  clarity: {
    name: 'Clarity',
    style: 'Modern & clear',
    mood: 'single column, clean accent line, most readable, any job, simple',
    photo: true,
    font: 'modern',
  },
  atelier: {
    name: 'Atelier',
    style: 'Creative sidebar',
    mood: 'deep colour sidebar with photo, creative, design, marketing',
    photo: true,
    font: 'modern',
  },
  ledger: {
    name: 'Ledger',
    style: 'Bold editorial',
    mood: 'Swiss grid, large name, numbered sections, technical, bold, minimal',
    photo: true,
    font: 'modern',
  },
  meridian: {
    name: 'Meridian',
    style: 'Bold & organised',
    mood: 'coloured header band, side column for skills, organised, healthcare, professional',
    photo: true,
    font: 'modern',
  },
  chronicle: {
    name: 'Chronicle',
    style: 'Timeline',
    mood: 'career timeline with dates in a margin, trades, long work history',
    photo: true,
    font: 'classic',
  },
  vivid: {
    name: 'Vivid',
    style: 'Bold & modern',
    mood: 'bold colour band, geometric art, overlapping portrait, energetic, young, colourful',
    photo: true,
    font: 'modern',
  },
  halo: {
    name: 'Halo',
    style: 'Warm portrait',
    mood: 'centred portrait in a ring, graceful, warm, personal, teaching, care',
    photo: true,
    font: 'humanist',
  },
  folio: {
    name: 'Folio',
    style: 'Editorial',
    mood: 'magazine style, two-tone name, serif headings, elegant, sophisticated',
    photo: true,
    font: 'classic',
  },
  sprout: {
    name: 'Sprout',
    style: 'Friendly & fresh',
    mood: 'rounded, soft, friendly, first job, student, retail, hospitality',
    photo: true,
    font: 'humanist',
  },
  heritage: {
    name: 'Heritage',
    style: 'Calm & classic',
    mood: 'centred serif, fine rules, traditional, senior, executive, law, finance, no photo',
    photo: false,
    font: 'classic',
  },
};

export const FONT_CATALOG: Record<FontPairId, string> = {
  modern: 'Inter — clean, contemporary sans-serif',
  classic: 'Source Serif headings — traditional, trustworthy',
  humanist: 'Lora + Nunito Sans — warm, friendly, approachable',
  executive: 'Cormorant Garamond headings — elegant, refined, luxurious',
  technical: 'IBM Plex Sans — precise, engineering',
};

export function catalogForPrompt(): string {
  const templates = Object.entries(TEMPLATE_CATALOG)
    .map(([id, t]) => `- ${id}: ${t.style}. ${t.mood}.${t.photo ? '' : ' (no photo)'}`)
    .join('\n');
  const fonts = Object.entries(FONT_CATALOG)
    .map(([id, d]) => `- ${id}: ${d}`)
    .join('\n');
  const colours = ACCENT_PALETTE.map((c) => `- ${c.name}: ${c.hex}`).join('\n');
  const presets = PROFESSIONS.map((p) => `- ${p.id}: ${p.name} (${p.example})`).join('\n');
  return `DESIGNS (templateId):\n${templates}\n\nFONTS (fontPair):\n${fonts}\n\nCOLOURS (accent; prefer these, any dark #RRGGBB allowed):\n${colours}\n\nDENSITY: compact | balanced | airy\n\nKINDS OF WORK (presetId):\n${presets}`;
}

export function presetDesign(id: PresetId) {
  return PRESETS[id].design;
}
