import { nanoid } from 'nanoid';
import { getPreset } from './presets';
import type { PresetId } from './professions';
import { designSpec, type ResumeDocument, type Section, type SectionKind } from './schema';

export const newId = () => nanoid(10);

export function emptySection(kind: SectionKind, title: string): Section {
  return { id: newId(), kind, title, hidden: false, items: [] } as Section;
}

/** Default page size from locale: US and Canada use Letter. */
export function defaultPageSize(locale: string): 'A4' | 'Letter' {
  return /-(US|CA)$/i.test(locale) ? 'Letter' : 'A4';
}

export function createDocument(
  presetId: PresetId,
  opts: { locale?: string; now?: Date } = {},
): ResumeDocument {
  const preset = getPreset(presetId);
  const locale = opts.locale ?? 'en-GB';
  const now = (opts.now ?? new Date()).toISOString();
  return {
    schemaVersion: 1,
    id: newId(),
    title: 'My CV',
    presetId,
    locale,
    createdAt: now,
    updatedAt: now,
    basics: { name: '', headline: '', email: '', phone: '', location: '', links: [], summary: '' },
    sections: preset.sections.map((s) => emptySection(s.kind, s.title)),
    design: designSpec.parse({ ...preset.design, pageSize: defaultPageSize(locale) }),
  };
}
