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

/** Studio actions the coach may offer (an allow-list; each maps to an existing screen or API route). */
export const COACH_TOOLS = [
  'tailor_cv',
  'application_kit',
  'cover_letter',
  'job_match',
  'mock_interview',
  'write_letter',
  'ats_check',
  'add_job',
  'design',
  'skill_gap',
] as const;
export type CoachTool = (typeof COACH_TOOLS)[number];

export const TASK_IDS = [
  'intake.interpret',
  'design.interpret',
  'write.summary',
  'write.improveBullets',
  'write.fromNotes',
  'write.rewrite',
  'suggest.skills',
  'import.structure',
  'job.match',
  'job.tailor',
  'letter.write',
  'letter.generic',
  'quality.atsKeywords',
  'linkedin.write',
  'interview.prep',
  'interview.turn',
  'coach.chat',
  'story.draft',
  'skills.gap',
  'jobs.extract',
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
  /** AI on a selection (R8.6): rewrite the selected words only. */
  'write.rewrite': z.object({
    text: z.string().trim().min(2).max(1500),
    mode: z.enum(['improve', 'shorten', 'expand', 'grammar', 'tone']),
    tone: z.enum(['formal', 'friendly']).default('formal'),
    /** The whole field the selection is in (facts may come from it too). */
    context: z.string().max(3000).default(''),
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
  'letter.generic': z.object({
    /** Letter type title and what the letter must do (from letters/types.ts, never from the user). */
    typeTitle: z.string().max(80),
    notes: z.string().max(1000),
    /** The person's answers to the type's questions. */
    answers: z
      .array(z.object({ question: z.string().max(200), answer: z.string().max(1500) }))
      .max(8),
    to: z.string().max(400).default(''),
    name: z.string().max(120),
    profile: z.string().min(20).max(24_000),
    tone: z.enum(['warm', 'formal']).default('warm'),
    /** Story-bank stories (R9.3), "S1: title [skills] — story" per line: the person's own facts. */
    stories: z.string().max(8000).default(''),
  }),
  'quality.atsKeywords': z.object({
    advert: z.string().min(80).max(12_000),
    profile: z.string().min(20).max(24_000),
  }),
  'interview.prep': z.object({
    advert: z.string().min(80).max(12_000),
    jobTitle: z.string().max(160),
    company: z.string().max(160),
    profile: z.string().min(20).max(24_000),
  }),
  /** Mock interview (R9): one turn — feedback on the last answer and the next question. */
  'interview.turn': z.object({
    advert: z.string().min(80).max(12_000),
    jobTitle: z.string().max(160),
    company: z.string().max(160),
    profile: z.string().min(20).max(24_000),
    /** Earlier questions and answers, oldest first. */
    transcript: z
      .array(z.object({ question: z.string().max(400), answer: z.string().max(3000) }))
      .max(10)
      .default([]),
    /** The question just answered, and the answer ('' when the interview starts). */
    question: z.string().max(400).default(''),
    answer: z.string().max(3000).default(''),
    /** Questions still to ask after this turn (0 = finish with a summary). */
    remaining: z.number().int().min(0).max(10),
    /** Story-bank stories (R9.3), "S1: title [skills] — story" per line: the person's own facts. */
    stories: z.string().max(8000).default(''),
  }),
  /** Career coach (R9): one chat turn with optional studio actions to offer. */
  'coach.chat': z.object({
    profile: z.string().min(20).max(24_000),
    /** The person's tracked jobs, one per line: "<id> | title | company | stage". */
    jobs: z.string().max(4000).default(''),
    history: z
      .array(z.object({ role: z.enum(['user', 'coach']), text: z.string().max(4000) }))
      .max(16)
      .default([]),
    message: z.string().trim().min(1).max(2000),
    /** Story-bank stories (R9.3), "S1: title [skills] — story" per line: the person's own facts. */
    stories: z.string().max(8000).default(''),
  }),
  'story.draft': z.object({
    profile: z.string().min(20).max(24_000),
    /** The CV point the story grows from (the person's own words). */
    point: z.string().trim().min(3).max(800),
    /** The job or project line it belongs to ("Van Driver, Swift Logistics (2019 to now)"). */
    role: z.string().max(300).default(''),
    /** What the person adds about it (optional, their words). */
    notes: z.string().max(2000).default(''),
    /** The person's skills; tags are chosen from these. */
    skills: z.array(z.string().max(60)).max(60).default([]),
  }),
  /** Job from URL (R9.5): the job in a fetched page's text (untrusted data). */
  'jobs.extract': z.object({
    url: z.string().max(500),
    pageTitle: z.string().max(300).default(''),
    siteName: z.string().max(160).default(''),
    text: z.string().min(1).max(14_000),
  }),
  /** Skill gap and learning plan (R9.4) for a target role or a tracked job's advert. */
  'skills.gap': z.object({
    profile: z.string().min(20).max(24_000),
    /** The role the person wants (their words, or the tracked job's title). */
    role: z.string().trim().min(2).max(160),
    /** The job advert when the target is a tracked job ('' for a typed role). */
    advert: z.string().max(12_000).default(''),
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
  'write.rewrite': z.object({ text: z.string().min(1).max(2000) }),
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
  'letter.generic': z.object({
    greeting: z.string().max(80),
    paragraphs: z.array(z.string().min(1).max(1200)).min(1).max(5),
    closing: z.string().max(80),
  }),
  'quality.atsKeywords': z.object({
    terms: z
      .array(
        z.object({
          /** As written in the advert, 1 to 4 words. */
          term: z.string().min(1).max(60),
          /** For a term the CV lacks: the id of a CV line that already shows it in other words, or "". */
          line: z.string().max(20),
        }),
      )
      .max(25),
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
  'interview.turn': z.object({
    feedback: z.object({
      verdict: z.enum(['strong', 'good', 'work-on']),
      /** Which parts of the STAR pattern the answer has. */
      star: z.object({
        situation: z.boolean(),
        task: z.boolean(),
        action: z.boolean(),
        result: z.boolean(),
      }),
      /** A short phrase copied exactly from the answer that the main point is about. */
      quote: z.string().max(300),
      strengths: z.array(z.string().max(240)).max(3),
      improve: z.array(z.string().max(240)).max(3),
      /** How to make it stronger with something from the CV. */
      tip: z.string().max(400),
    }),
    next: z.object({
      question: z.string().max(300),
      kind: z.enum(['experience', 'skills', 'situation', 'motivation', 'gap']),
    }),
    summary: z.string().max(900),
  }),
  'coach.chat': z.object({
    reply: z.string().min(1).max(2400),
    /** Studio actions to offer as buttons (the person decides; each goes through the usual checks). */
    actions: z
      .array(
        z.object({
          tool: z.enum(COACH_TOOLS),
          /** Job id for job tools, letter type for write_letter, otherwise "". */
          arg: z.string().max(80),
        }),
      )
      .max(3),
  }),
  'jobs.extract': z.object({
    /** False when the page is not a single job advert (a list, a sign-in wall, an article…). */
    isJob: z.boolean(),
    title: z.string().max(160),
    company: z.string().max(160),
    location: z.string().max(120),
    /** The advert's first 6–10 words and last 6–10 words, copied exactly from the page. */
    start: z.string().max(200),
    end: z.string().max(200),
  }),
  'skills.gap': z.object({
    skills: z
      .array(
        z.object({
          name: z.string().min(1).max(60),
          importance: z.enum(['core', 'useful']),
          status: z.enum(['have', 'partly', 'missing']),
          /** CV line ids (e.g. "J1.B2"); checked against the CV by the app. */
          evidence: z.array(z.string().max(20)).max(4),
          note: z.string().max(240),
        }),
      )
      .min(1)
      .max(14),
    /** What to learn first, most useful first. */
    plan: z
      .array(
        z.object({
          skill: z.string().min(1).max(60),
          why: z.string().max(240),
          how: z.string().max(400),
          proof: z.string().max(240),
          weeks: z.number().int().min(1).max(52),
        }),
      )
      .max(5),
    summary: z.string().max(500),
  }),
  'story.draft': z.object({
    title: z.string().min(1).max(120),
    situation: z.string().max(1200),
    task: z.string().max(1200),
    action: z.string().min(1).max(1200),
    result: z.string().max(1200),
    skills: z.array(z.string().max(60)).max(5),
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
