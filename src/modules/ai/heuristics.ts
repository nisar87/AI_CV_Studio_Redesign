import { PRESETS } from '@/modules/resume/presets';
import type { PresetId } from '@/modules/resume/professions';
import type { Density, FontPairId, TemplateId } from '@/modules/resume/schema';
import { TEMPLATE_CATALOG } from './catalog';
import type { DesignChoice } from './schemas';

/**
 * Keyword interpretation of "what do you need" and "describe a style". Deterministic; used by
 * the mock provider (tests, keyless development).
 */

const PRESET_WORDS: [PresetId, RegExp][] = [
  ['driver', /\b(driv|deliver|courier|van|truck|lorry|hgv|taxi|chauffeur|forklift)/],
  ['teacher', /\b(teach|tutor|school|classroom|lecturer|nursery|teaching assistant)/],
  ['healthcare', /\b(nurs|carer|care worker|health|clinic|hospital|pharma|midwife|doctor)/],
  [
    'retail',
    /\b(shop|retail|cashier|waiter|waitress|barista|cafe|café|hotel|reception|sales assistant)/,
  ],
  ['trades', /\b(electrician|plumb|builder|construction|mechanic|carpent|welder|joiner|trade)/],
  ['tech', /\b(developer|engineer|software|programm|it support|data|devops|web)/],
  ['office', /\b(admin|office|account|bookkeep|customer service|secretary|receptionist|clerk)/],
  ['executive', /\b(director|head of|chief|executive|ceo|cfo|vp|vice president|senior manager)/],
  ['student', /\b(student|graduate|school leaver|first job|intern|apprentice)/],
];

const COLOUR_WORDS: [RegExp, string][] = [
  [/\bnavy\b/, '#1f3a5f'],
  [/\b(blue)\b/, '#1f4e8c'],
  [/\b(teal|turquoise)\b/, '#1e6a6a'],
  [/\b(green|olive|emerald)\b/, '#2d6a3e'],
  [/\b(purple|plum|violet)\b/, '#5b2a6e'],
  [/\b(pink|berry|red|burgundy|maroon)\b/, '#7a2e4d'],
  [/\b(orange|rust|terracotta)\b/, '#9a4a12'],
  [/\b(brown|bronze|gold)\b/, '#7a5a2e'],
  [/\b(grey|gray|black|graphite|charcoal|monochrome)\b/, '#33383f'],
];

const STYLE_WORDS: [RegExp, Partial<Record<'template' | 'font', string>>][] = [
  [/\b(elegant|graceful|refined|luxur)/, { font: 'executive' }],
  [/\b(classic|traditional|formal|conservative)/, { template: 'heritage', font: 'classic' }],
  [/\b(creative|artistic|designer)/, { template: 'atelier' }],
  [/\b(bold|striking|energetic|vibrant|colourful|colorful)/, { template: 'vivid' }],
  [/\b(friendly|fresh|soft|rounded|playful)/, { template: 'sprout', font: 'humanist' }],
  [/\b(warm|caring|personal)/, { template: 'halo', font: 'humanist' }],
  [/\b(timeline)/, { template: 'chronicle' }],
  [/\b(magazine|editorial)/, { template: 'folio' }],
  [/\b(technical|precise|swiss|grid)/, { template: 'ledger', font: 'technical' }],
  [/\b(simple|plain|clean|minimal|readable)/, { template: 'clarity' }],
];

export function guessPreset(description: string): PresetId {
  const d = description.toLowerCase();
  return PRESET_WORDS.find(([, re]) => re.test(d))?.[0] ?? 'general';
}

export function guessDesign(
  description: string,
  presetId: PresetId,
  current: Partial<DesignChoice> = {},
): DesignChoice {
  const d = description.toLowerCase();
  const base = PRESETS[presetId].design;
  let templateId: TemplateId = (current.templateId as TemplateId) ?? base.templateId;
  let fontPair: FontPairId = (current.fontPair as FontPairId) ?? base.fontPair;
  let accent = current.accent ?? base.accent;
  let density: Density = current.density ?? 'balanced';
  // Design first (first matching word wins), then explicit font words override its default font.
  const styled = STYLE_WORDS.filter(([re]) => re.test(d));
  const pickedTemplate = styled.find(([, p]) => p.template)?.[1].template as TemplateId | undefined;
  if (pickedTemplate) {
    templateId = pickedTemplate;
    fontPair = TEMPLATE_CATALOG[templateId].font;
  }
  const pickedFont = styled.find(([, p]) => p.font && !p.template)?.[1].font;
  if (pickedFont) fontPair = pickedFont as FontPairId;
  const colour = COLOUR_WORDS.find(([re]) => re.test(d));
  if (colour) accent = colour[1];
  if (/\b(compact|dense|one page|fit)/.test(d)) density = 'compact';
  if (/\b(spacious|airy|lots of space|breath)/.test(d)) density = 'airy';
  return { templateId, fontPair, accent, density };
}

/** "a simple CV for a delivery driver" → "Delivery Driver" (only words the person used). */
export function guessTitle(description: string): string {
  const m = description.match(
    /\b(?:as an?|for an?|i am an?|i'm an?|im an?|work as an?|job as an?)\s+([a-z][a-z\s-]{2,40}?)(?=[,.;!]|\s+(?:with|in|and|who|that|looking|cv|resume)\b|$)/i,
  );
  if (!m) return '';
  return m[1]!
    .trim()
    .split(/\s+/)
    .filter((w) => !/^(simple|modern|clean|new|good|nice|professional)$/i.test(w))
    .map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
