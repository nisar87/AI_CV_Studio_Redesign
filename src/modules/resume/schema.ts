import { z } from 'zod';
import { designSpecV2 } from '@/modules/design/spec';
import { DENSITIES, FONT_PAIR_IDS, PAGE_SIZES, TEMPLATE_IDS } from './ids';
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
  keywords: z.array(z.string().max(160)).max(60).default([]),
  /** Optional level 1–5 per keyword (same order; 0 = not set). Unlocks bars and dots honestly. */
  levels: z.array(z.number().int().min(0).max(5).catch(0)).max(60).optional(),
});

/** CEFR or plain-language levels; '' = not set. */
export const LANGUAGE_LEVELS = [
  '',
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'basic',
  'conversational',
  'fluent',
  'native',
] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

/** Fluency can be a sentence ("Fluent / professional working proficiency – …"); never cut on import. */
export const languageItem = z.object({
  id,
  language: text(80),
  fluency: text(240),
  level: z.enum(LANGUAGE_LEVELS).optional().catch(undefined),
});

export const credentialItem = z.object({
  id,
  name: text(200),
  issuer: text(160),
  date: partialDate,
  detail: text(300),
  /** Optional link (publications, talks). */
  link: z.string().max(300).optional(),
});

/** R8 section types (complete-studio-spec §9.2). */
export const referenceItem = z.object({
  id,
  name: text(120),
  role: text(160),
  organization: text(160),
  /** Email or phone, or "Available on request". */
  contact: text(200),
});
export const strengthItem = z.object({ id, title: text(120), text: text(300) });
/** Must be supplied by the person (never generated). */
export const testimonialItem = z.object({ id, quote: text(600), name: text(120), role: text(160) });
export const detailItem = z.object({ id, label: text(60), value: text(200) });
export const declarationItem = z.object({
  id,
  text: text(800),
  place: text(120),
  date: text(60),
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
  // R8: 14 more kinds, most reusing an existing item shape (spec §9.2).
  z.object({ ...sectionBase, kind: z.literal('publications'), items: items(credentialItem) }),
  z.object({ ...sectionBase, kind: z.literal('courses'), items: items(credentialItem) }),
  z.object({ ...sectionBase, kind: z.literal('memberships'), items: items(credentialItem) }),
  z.object({ ...sectionBase, kind: z.literal('conferences'), items: items(credentialItem) }),
  z.object({ ...sectionBase, kind: z.literal('patents'), items: items(credentialItem) }),
  z.object({ ...sectionBase, kind: z.literal('military'), items: items(experienceItem) }),
  z.object({ ...sectionBase, kind: z.literal('internships'), items: items(experienceItem) }),
  z.object({ ...sectionBase, kind: z.literal('interests'), items: items(skillGroupItem) }),
  z.object({ ...sectionBase, kind: z.literal('achievements'), items: items(customItem) }),
  z.object({ ...sectionBase, kind: z.literal('references'), items: items(referenceItem) }),
  z.object({ ...sectionBase, kind: z.literal('strengths'), items: items(strengthItem) }),
  z.object({ ...sectionBase, kind: z.literal('testimonials'), items: items(testimonialItem) }),
  z.object({ ...sectionBase, kind: z.literal('personalDetails'), items: items(detailItem) }),
  z.object({ ...sectionBase, kind: z.literal('declaration'), items: items(declarationItem) }),
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
  'publications',
  'courses',
  'memberships',
  'conferences',
  'patents',
  'military',
  'internships',
  'interests',
  'achievements',
  'references',
  'strengths',
  'testimonials',
  'personalDetails',
  'declaration',
] as const;

/**
 * How each kind is laid out by the templates and the design engine: new kinds borrow an existing
 * kind's layout (and side-column placement), so every design supports them without new code.
 */
export const LAYOUT_KIND: Record<(typeof SECTION_KINDS)[number], (typeof SECTION_KINDS)[number]> = {
  experience: 'experience',
  education: 'education',
  skills: 'skills',
  languages: 'languages',
  certifications: 'certifications',
  licences: 'licences',
  projects: 'projects',
  volunteering: 'volunteering',
  awards: 'awards',
  custom: 'custom',
  publications: 'certifications',
  courses: 'certifications',
  memberships: 'certifications',
  conferences: 'certifications',
  patents: 'certifications',
  military: 'experience',
  internships: 'experience',
  interests: 'skills',
  achievements: 'custom',
  references: 'custom',
  strengths: 'custom',
  testimonials: 'custom',
  personalDetails: 'languages',
  declaration: 'custom',
};

export {
  TEMPLATE_IDS,
  SPEC_DESIGN_IDS,
  DESIGN_IDS,
  FONT_PAIR_IDS,
  DENSITIES,
  PAGE_SIZES,
} from './ids';

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
      /** Show the profile photo in designs that support one (default: yes, if a photo was added). */
      showPhoto: z.boolean().optional(),
    })
    .default({}),
  /**
   * Design Spec v2 (R6). When present it is the source of truth for the look; the fields above
   * are kept in sync (design/catalogue.ts toV1) for readers that only know v1.
   */
  v2: designSpecV2.optional(),
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
  /** Optional profile photo as a small JPEG/PNG/WebP data URL (resized in the browser). */
  photo: z
    .string()
    .max(400_000)
    .regex(/^$|^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Invalid image')
    .default(''),
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
  /** "profile": the account's career profile (master record) that CVs are made from. */
  role: z.enum(['cv', 'profile']).optional(),
  /** Set on a CV tailored for a job in the tracker. */
  jobId: z.string().max(64).optional(),
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
export type ReferenceItem = z.infer<typeof referenceItem>;
export type StrengthItem = z.infer<typeof strengthItem>;
export type TestimonialItem = z.infer<typeof testimonialItem>;
export type DetailItem = z.infer<typeof detailItem>;
export type DeclarationItem = z.infer<typeof declarationItem>;
export type DesignSpec = z.infer<typeof designSpec>;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
/** Any catalogue design, hand-crafted or spec-only (R7). */
export type DesignId = (typeof import('./ids').DESIGN_IDS)[number];
export type SpecDesignId = (typeof import('./ids').SPEC_DESIGN_IDS)[number];
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
