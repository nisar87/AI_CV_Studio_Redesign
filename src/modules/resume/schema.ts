import { z } from 'zod';
import { PRESET_IDS } from './professions';

/**
 * Canonical resume document schema. See docs/engineering/data-model.md.
 * Content and design are separate: templates read `design`, never change content.
 */

const text = (max: number) => z.string().max(max).default('');
const id = z.string().min(1).max(64);
/** "", "YYYY" or "YYYY-MM" */
export const partialDate = z
  .string()
  .regex(/^$|^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Use YYYY or YYYY-MM')
  .default('');

const lines = z.array(z.string().max(600)).max(40).default([]);

export const experienceItem = z.object({
  id,
  role: text(160),
  organization: text(160),
  location: text(120),
  start: partialDate,
  end: partialDate,
  current: z.boolean().default(false),
  bullets: lines,
});

export const educationItem = z.object({
  id,
  qualification: text(200),
  institution: text(200),
  location: text(120),
  start: partialDate,
  end: partialDate,
  details: lines,
});

export const skillGroupItem = z.object({
  id,
  label: text(80),
  keywords: z.array(z.string().max(80)).max(60).default([]),
});

export const languageItem = z.object({ id, language: text(80), fluency: text(80) });

export const credentialItem = z.object({
  id,
  name: text(200),
  issuer: text(160),
  date: partialDate,
  detail: text(300),
});

export const projectItem = z.object({
  id,
  name: text(160),
  role: text(120),
  link: text(300),
  start: partialDate,
  end: partialDate,
  bullets: lines,
});

export const customItem = z.object({
  id,
  title: text(200),
  subtitle: text(200),
  date: text(60),
  bullets: lines,
});

const sectionBase = { id, title: text(80), hidden: z.boolean().default(false) };
const items = <T extends z.ZodTypeAny>(item: T) => z.array(item).max(50).default([]);

export const section = z.discriminatedUnion('kind', [
  z.object({ ...sectionBase, kind: z.literal('experience'), items: items(experienceItem) }),
  z.object({ ...sectionBase, kind: z.literal('volunteering'), items: items(experienceItem) }),
  z.object({ ...sectionBase, kind: z.literal('education'), items: items(educationItem) }),
  z.object({ ...sectionBase, kind: z.literal('skills'), items: items(skillGroupItem) }),
  z.object({ ...sectionBase, kind: z.literal('languages'), items: items(languageItem) }),
  z.object({ ...sectionBase, kind: z.literal('certifications'), items: items(credentialItem) }),
  z.object({ ...sectionBase, kind: z.literal('licences'), items: items(credentialItem) }),
  z.object({ ...sectionBase, kind: z.literal('awards'), items: items(credentialItem) }),
  z.object({ ...sectionBase, kind: z.literal('projects'), items: items(projectItem) }),
  z.object({ ...sectionBase, kind: z.literal('custom'), items: items(customItem) }),
]);

export const SECTION_KINDS = [
  'experience',
  'education',
  'skills',
  'languages',
  'certifications',
  'licences',
  'projects',
  'volunteering',
  'awards',
  'custom',
] as const;

export const TEMPLATE_IDS = ['clarity', 'meridian', 'heritage'] as const;
export const FONT_PAIR_IDS = ['modern', 'classic', 'humanist', 'executive', 'technical'] as const;
export const DENSITIES = ['compact', 'balanced', 'airy'] as const;
export const PAGE_SIZES = ['A4', 'Letter'] as const;

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');

export const designSpec = z.object({
  templateId: z.enum(TEMPLATE_IDS).default('clarity'),
  accent: hexColor.default('#1f4e8c'),
  fontPair: z.enum(FONT_PAIR_IDS).default('modern'),
  density: z.enum(DENSITIES).default('balanced'),
  pageSize: z.enum(PAGE_SIZES).default('A4'),
  options: z
    .object({
      headerAlign: z.enum(['left', 'center']).optional(),
      skillStyle: z.enum(['tags', 'inline']).optional(),
    })
    .default({}),
});

export const basics = z.object({
  name: text(120),
  headline: text(160),
  email: text(160),
  phone: text(60),
  location: text(160),
  links: z
    .array(z.object({ id, label: text(60), url: text(300) }))
    .max(10)
    .default([]),
  summary: text(1500),
});

export const resumeDocument = z.object({
  schemaVersion: z.literal(1),
  id,
  title: text(120),
  presetId: z.enum(PRESET_IDS),
  locale: z.string().max(35).default('en-GB'),
  createdAt: z.string(),
  updatedAt: z.string(),
  parentId: z.string().optional(),
  basics,
  sections: z.array(section).max(30),
  design: designSpec,
});

export type ResumeDocument = z.infer<typeof resumeDocument>;
export type Section = z.infer<typeof section>;
export type SectionKind = Section['kind'];
export type SectionOf<K extends SectionKind> = Extract<Section, { kind: K }>;
export type ExperienceItem = z.infer<typeof experienceItem>;
export type EducationItem = z.infer<typeof educationItem>;
export type SkillGroupItem = z.infer<typeof skillGroupItem>;
export type LanguageItem = z.infer<typeof languageItem>;
export type CredentialItem = z.infer<typeof credentialItem>;
export type ProjectItem = z.infer<typeof projectItem>;
export type CustomItem = z.infer<typeof customItem>;
export type DesignSpec = z.infer<typeof designSpec>;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type FontPairId = (typeof FONT_PAIR_IDS)[number];
export type Density = (typeof DENSITIES)[number];
export type PageSize = (typeof PAGE_SIZES)[number];
export type Basics = z.infer<typeof basics>;

/** Validate unknown input (storage, API, backups). Throws ZodError on failure. */
export function parseResumeDocument(input: unknown): ResumeDocument {
  return resumeDocument.parse(migrate(input));
}

export function safeParseResumeDocument(input: unknown) {
  return resumeDocument.safeParse(migrate(input));
}

/** Upgrade older documents to the current schema version. Version 1 is current. */
export function migrate(input: unknown): unknown {
  return input;
}
