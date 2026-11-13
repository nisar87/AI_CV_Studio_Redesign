import type { ResumeDocument } from './schema';

/**
 * Edit on the page (complete-studio-spec §9.1): the preview reports which block was clicked and the
 * clicked element's text. If that text is exactly one field of the person's CV, it can be edited in
 * place; anything built from several fields (a date range, "Employer · Town") stays click-to-jump.
 */
export type InlineField =
  | { kind: 'basics'; key: 'name' | 'headline' | 'email' | 'phone' | 'location' | 'summary' }
  | { kind: 'item'; sectionId: string; itemId: string; key: string; index?: number };

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const BASICS = ['name', 'headline', 'email', 'phone', 'location', 'summary'] as const;
/** Fields that are plain single-line or paragraph text (not dates, links or flags). */
const TEXT_KEYS = new Set([
  'role',
  'organization',
  'location',
  'qualification',
  'institution',
  'label',
  'language',
  'fluency',
  'name',
  'issuer',
  'detail',
  'title',
  'subtitle',
  'contact',
  'text',
  'quote',
  'value',
  'place',
]);
const LIST_KEYS = ['bullets', 'details', 'keywords'] as const;

export function findInlineField(
  doc: ResumeDocument,
  ref: string,
  text: string,
): InlineField | null {
  const t = clean(text);
  if (!t || t.length > 1500) return null;
  const [a, b] = ref.split('/');
  if (a === 'basics') {
    for (const key of BASICS) if (clean(doc.basics[key]) === t) return { kind: 'basics', key };
    return null;
  }
  const section = doc.sections.find((s) => s.id === a);
  const item = section?.items.find((i) => i.id === b) as Record<string, unknown> | undefined;
  if (!section || !item || !b) return null;
  const matches: InlineField[] = [];
  for (const [key, v] of Object.entries(item)) {
    if (typeof v === 'string' && TEXT_KEYS.has(key) && clean(v) === t)
      matches.push({ kind: 'item', sectionId: a!, itemId: b, key });
    if ((LIST_KEYS as readonly string[]).includes(key) && Array.isArray(v))
      (v as string[]).forEach((x, index) => {
        if (clean(x) === t) matches.push({ kind: 'item', sectionId: a!, itemId: b, key, index });
      });
  }
  // Ambiguous (the same text in two fields): don't guess.
  return matches.length === 1 ? matches[0]! : null;
}

/** The patch for ops: basics fields, or the item's field (a list keeps its other entries). */
export function inlinePatch(
  doc: ResumeDocument,
  f: InlineField,
  next: string,
):
  | { basics: Record<string, string> }
  | { sectionId: string; itemId: string; patch: Record<string, unknown> }
  | null {
  const value = f.kind === 'basics' && f.key === 'summary' ? next.trim() : clean(next);
  if (f.kind === 'basics') return { basics: { [f.key]: value } };
  const item = doc.sections
    .find((s) => s.id === f.sectionId)
    ?.items.find((i) => i.id === f.itemId) as Record<string, unknown> | undefined;
  if (!item) return null;
  if (f.index === undefined)
    return { sectionId: f.sectionId, itemId: f.itemId, patch: { [f.key]: value } };
  const list = [...((item[f.key] as string[]) ?? [])];
  if (f.index >= list.length) return null;
  if (value) list[f.index] = value;
  else list.splice(f.index, 1);
  return { sectionId: f.sectionId, itemId: f.itemId, patch: { [f.key]: list } };
}
