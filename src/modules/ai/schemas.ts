import { z } from 'zod';
import { PRESET_IDS } from '@/modules/resume/professions';
import { DENSITIES, FONT_PAIR_IDS, TEMPLATE_IDS, hexColor } from '@/modules/resume/schema';

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

export const taskInputs = {
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
} satisfies Record<TaskId, z.ZodType>;

/**
 * Output schemas sent to the model as JSON Schema. Kept flat and small: Gemini rejects very
 * large or deeply nested schemas. Length limits are enforced here by Zod (the model may ignore
 * maxLength in the schema).
 */
export const taskOutputs = {
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
