import { z } from 'zod';
import { PRESET_IDS } from '@/modules/resume/professions';
import {
  DENSITIES,
  DESIGN_IDS,
  FONT_PAIR_IDS,
  TEMPLATE_IDS,
  hexColor,
} from '@/modules/resume/schema';
import { FIELDS, FIELD_NAMES, type FieldDef } from '@/modules/design/vocab';

/**
 * Input and output contracts of every AI task. Shared by the API route (validation),
 * the providers (JSON schema for structured output) and the client (types).
 * Inputs carry only the fields a task needs (docs/engineering/ai-architecture.md → Privacy).
 */

export const TASK_IDS = [
  'intake.interpret',
  'design.interpret',
  'write.summary',
  'write.improveBullets',
  'write.fromNotes',
  'suggest.skills',
  'import.structure',
  'job.match',
  'job.tailor',
  'letter.write',
  'linkedin.write',
  'interview.prep',
  'import.transcribe',
  'makeover.diagnose',
  'design.compose',
  'design.refine',
] as const;
export type TaskId = (typeof TASK_IDS)[number];

const short = (max: number) => z.string().trim().max(max);
const lines = (maxItems: number, maxLen = 600) => z.array(short(maxLen)).max(maxItems);

const job = z.object({
  role: short(160).default(''),
  organization: short(160).default(''),
  start: short(7).default(''),
  end: short(7).default(''),
  current: z.boolean().default(false),
  bullets: lines(12).default([]),
});

export const designChoice = z.object({
  templateId: z.enum(TEMPLATE_IDS),
  accent: hexColor,
  fontPair: z.enum(FONT_PAIR_IDS),
  density: z.enum(DENSITIES),
});
export type DesignChoice = z.infer<typeof designChoice>;

/** The flat design fields as an all-optional object (the model sets only what it changes). */
const designChoices = z.object(
  Object.fromEntries(
    FIELD_NAMES.map((n) => {
      const f: FieldDef = FIELDS[n];
      const t =
        f.kind === 'enum'
          ? z.enum(f.values as [string, ...string[]])
          : f.kind === 'kinds'
            ? z.array(z.enum(f.values as [string, ...string[]])).max(6)
            : f.kind === 'number'
              ? z.number()
              : f.kind === 'bool'
                ? z.boolean()
                : z.string().regex(/^#[0-9a-fA-F]{6}$/);
      return [n, t.optional()];
    }),
  ),
);

export const taskInputs = {
  'design.compose': z.object({
    description: short(600).default(''),
    presetId: z.enum(PRESET_IDS),
    /** Content statistics (no CV text): length, section sizes, photo. */
    stats: z.object({
      pages: z.number().min(0).max(10),
      sections: z
        .array(
          z.object({
            kind: short(20),
            items: z.number().int().min(0).max(99),
            chars: z.number().int().min(0).max(100_000),
          }),
        )
        .max(30),
      hasPhoto: z.boolean(),
    }),
    /** Current design as flat fields, plus the catalogue design it is (or started from). */
    current: z.record(z.string(), z.unknown()).default({}),
    currentDesign: z.enum(DESIGN_IDS).optional(),
    hasImage: z.boolean().default(false),
  }),
  'design.refine': z.object({
    instruction: short(300).min(2),
    current: z.record(z.string(), z.unknown()),
  }),
  'intake.interpret': z.object({ description: short(600).min(3) }),
  'design.interpret': z.object({
    description: short(400).min(2),
    presetId: z.enum(PRESET_IDS),
    current: designChoice.partial().default({}),
  }),
  'write.summary': z.object({
    presetId: z.enum(PRESET_IDS),
    headline: short(160).default(''),
    currentSummary: short(1500).default(''),
    mode: z.enum(['write', 'improve', 'shorter']).default('write'),
    experience: z.array(job).max(6).default([]),
    education: z.array(short(300)).max(6).default([]),
    skills: z.array(short(80)).max(40).default([]),
  }),
  'write.improveBullets': z.object({
    presetId: z.enum(PRESET_IDS),
    role: short(160).default(''),
    organization: short(160).default(''),
    bullets: lines(12).min(1),
    instruction: z.enum(['clearer', 'shorter', 'professional']),
  }),
  'write.fromNotes': z.object({
    presetId: z.enum(PRESET_IDS),
    role: short(160).default(''),
    organization: short(160).default(''),
    notes: short(2000).min(3),
  }),
  'suggest.skills': z.object({
    presetId: z.enum(PRESET_IDS),
    headline: short(160).default(''),
    experience: z.array(short(400)).max(20).default([]),
    existing: z.array(short(80)).max(60).default([]),
  }),
  'import.structure': z.object({
    lines: z.array(z.string().max(600)).min(1).max(400),
  }),
  /** The file itself travels as an attachment (RunDeps.files); this only says what it is. */
  'import.transcribe': z.object({
    kind: z.enum(['pdf', 'image']),
  }),
  'makeover.diagnose': z.object({
    chip: z.enum(['wording', 'bullets']),
    presetId: z.enum(PRESET_IDS),
    /** Addressed lines of the CV, e.g. { id: "experience.0.bullets.2", text: "..." }. */
    items: z
      .array(z.object({ id: z.string().max(80), text: z.string().min(1).max(600) }))
      .min(1)
      .max(60),
    /** Other words of the CV (names, employers, titles) the guard may accept. */
    context: z.string().max(12_000).default(''),
  }),
  'job.match': z.object({
    advert: z.string().min(80).max(12_000),
    /** The CV as numbered lines (see modules/jobs/digest.ts). */
    profile: z.string().min(20).max(24_000),
  }),
  'job.tailor': z.object({
    advert: z.string().min(80).max(12_000),
    jobTitle: z.string().max(160),
    company: z.string().max(160),
    profile: z.string().min(20).max(24_000),
  }),
  'letter.write': z.object({
    advert: z.string().min(80).max(12_000),
    jobTitle: z.string().max(160),
    company: z.string().max(160),
    name: z.string().max(120),
    profile: z.string().min(20).max(24_000),
    tone: z.enum(['warm', 'formal']).default('warm'),
  }),
  'interview.prep': z.object({
    advert: z.string().min(80).max(12_000),
    jobTitle: z.string().max(160),
    company: z.string().max(160),
    profile: z.string().min(20).max(24_000),
  }),
  'linkedin.write': z.object({
    profile: z.string().min(20).max(24_000),
    /** The kind of role the person wants next (optional, their words). */
    target: z.string().max(160).default(''),
  }),
} satisfies Record<TaskId, z.ZodType>;

export const IMPORT_KINDS = [
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
/** "YYYY-MM", "YYYY" or "" — checked again when mapped (no transforms: they can't be sent as JSON Schema). */
const ymd = z.string().max(10);

/**
 * Output schemas sent to the model as JSON Schema. Kept flat and small: Gemini rejects very
 * large or deeply nested schemas. Length limits are enforced here by Zod (the model may ignore
 * maxLength in the schema).
 */
export const taskOutputs = {
  'design.compose': z.object({
    candidates: z
      .array(
        z.object({
          name: z.string().max(40),
          explanation: z.string().max(240),
          startFrom: z.enum(DESIGN_IDS),
          choices: designChoices,
          unmet: z.array(z.string().max(200)).max(4).default([]),
        }),
      )
      .min(1)
      .max(3),
  }),
  'design.refine': z.object({
    changes: z
      .array(
        z.object({
          field: z.enum(FIELD_NAMES as [string, ...string[]]),
          value: z.string().max(120),
        }),
      )
      .max(12),
    note: z.string().max(240).default(''),
  }),
  'intake.interpret': z.object({
    presetId: z.enum(PRESET_IDS),
    targetTitle: z.string().max(120),
    design: designChoice,
    reason: z.string().max(240),
  }),
  'design.interpret': z.object({
    choices: z
      .array(
        z.object({
          name: z.string().max(40),
          explanation: z.string().max(220),
          design: designChoice,
        }),
      )
      .min(1)
      .max(3),
  }),
  'write.summary': z.object({ text: z.string().min(1).max(700) }),
  'write.improveBullets': z.object({ bullets: z.array(z.string().min(1).max(260)).min(1).max(12) }),
  'write.fromNotes': z.object({ bullets: z.array(z.string().min(1).max(260)).min(1).max(8) }),
  'suggest.skills': z.object({ skills: z.array(z.string().min(1).max(60)).min(1).max(12) }),
  'import.transcribe': z.object({
    lines: z.array(z.string().max(600)).max(600),
    /** True when the page shows a photo of the person. */
    photo: z.boolean(),
  }),
  'makeover.diagnose': z.object({
    items: z
      .array(
        z.object({
          id: z.string().max(80),
          after: z.string().min(1).max(600),
          reason: z.string().max(160),
        }),
      )
      .max(60),
  }),
  /** One generic entry shape for every kind keeps the schema small (see import/ai.ts mapping). */
  'import.structure': z.object({
    name: z.string().max(120),
    headline: z.string().max(160),
    email: z.string().max(160),
    phone: z.string().max(60),
    location: z.string().max(160),
    links: z.array(z.object({ label: z.string().max(60), url: z.string().max(300) })).max(10),
    summary: z.string().max(1500),
    sections: z
      .array(
        z.object({
          kind: z.enum(IMPORT_KINDS),
          title: z.string().max(80),
          entries: z
            .array(
              z.object({
                title: z.string().max(200),
                subtitle: z.string().max(200),
                place: z.string().max(160),
                start: ymd,
                end: ymd,
                current: z.boolean(),
                lines: z.array(z.string().max(600)).max(60),
              }),
            )
            .max(50),
        }),
      )
      .max(30),
  }),
  'job.match': z.object({
    requirements: z
      .array(
        z.object({
          text: z.string().min(1).max(220),
          importance: z.enum(['must', 'nice']),
          status: z.enum(['met', 'partial', 'missing']),
          /** Line ids from the CV (e.g. "J1.B2"); checked against the CV by the app. */
          evidence: z.array(z.string().max(20)).max(4),
          note: z.string().max(240),
        }),
      )
      .min(1)
      .max(15),
    keywords: z.array(z.string().min(1).max(60)).max(20),
    summary: z.string().max(500),
  }),
  'job.tailor': z.object({
    headline: z.string().max(100),
    summary: z.string().max(900),
    /** Per job id, its bullet ids in the order that best fits this job. */
    order: z
      .array(z.object({ job: z.string().max(10), bullets: z.array(z.string().max(20)).max(40) }))
      .max(30),
    /** Skills from the CV, most relevant first. */
    skills: z.array(z.string().max(80)).max(60),
  }),
  'letter.write': z.object({
    greeting: z.string().max(80),
    paragraphs: z.array(z.string().min(1).max(1200)).min(2).max(5),
    closing: z.string().max(80),
    /** A short covering email to send the CV and letter with. */
    email: z.object({ subject: z.string().max(160), body: z.string().max(1500) }),
  }),
  'interview.prep': z.object({
    questions: z
      .array(
        z.object({
          question: z.string().min(1).max(240),
          kind: z.enum(['experience', 'skills', 'situation', 'motivation', 'gap']),
          /** What the employer is checking, from the advert. */
          why: z.string().max(240),
          /** First-person answer notes from the CV. */
          points: z.array(z.string().max(260)).max(4),
          /** CV line ids the notes come from. */
          evidence: z.array(z.string().max(20)).max(4),
        }),
      )
      .min(3)
      .max(10),
    tips: z.array(z.string().max(220)).max(4),
  }),
  'linkedin.write': z.object({
    headline: z.string().max(220),
    about: z.string().max(2600),
    experience: z.array(z.object({ job: z.string().max(12), text: z.string().max(2000) })).max(12),
    skills: z.array(z.string().max(80)).max(15),
  }),
} satisfies Record<TaskId, z.ZodType>;

export type TaskInput<T extends TaskId> = z.input<(typeof taskInputs)[T]>;
export type ParsedInput<T extends TaskId> = z.output<(typeof taskInputs)[T]>;
export type TaskOutput<T extends TaskId> = z.output<(typeof taskOutputs)[T]>;

/** Successful API response body (docs/engineering/api-contracts.md). */
export type AiResponse<T extends TaskId> = {
  task: T;
  version: string;
  provider: 'gemini' | 'mock';
  result: TaskOutput<T>;
  /** Questions the user must answer (from `{{?…}}` markers in the result). */
  needsInput: string[];
  usage: { remainingToday: number };
};

export function isTaskId(x: string): x is TaskId {
  return (TASK_IDS as readonly string[]).includes(x);
}
