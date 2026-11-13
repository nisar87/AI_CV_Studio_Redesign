import { z } from 'zod';
import { letter } from '@/modules/letters/schema';
import type { InterviewPrep } from './interview';
import type { MatchResult } from './match';

/** Job tracker (Release 2). Jobs live in the account (users/{uid}/jobs/{id}); server-side only. */
export const JOB_STAGES = ['saved', 'applied', 'interview', 'offer', 'closed'] as const;
export type JobStage = (typeof JOB_STAGES)[number];
export const STAGE_LABEL: Record<JobStage, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  closed: 'Closed',
};

export const jobInput = z.object({
  title: z.string().trim().min(1, 'Add the job title.').max(160),
  company: z.string().trim().max(160).default(''),
  location: z.string().trim().max(120).default(''),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => !u || /^https?:\/\/\S+$/i.test(u), 'Use a full link starting with https://')
    .default(''),
  /** The advert text, pasted by the person (used for matching and letters). */
  advert: z.string().max(20_000).default(''),
  stage: z.enum(JOB_STAGES).default('saved'),
  notes: z.string().max(4000).default(''),
  /** yyyy-mm-dd, when they applied (set automatically when moved to Applied). */
  appliedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(''))
    .default(''),
  /** CVs (or letters) used for this application. */
  documentIds: z.array(z.string().max(64)).max(10).default([]),
  /** Cover letter for this job (drafted with AI, edited by the person). */
  letter: letter.optional(),
  /** The person's own notes for each interview question (same order as `interview.questions`). */
  interviewNotes: z.array(z.string().max(2000)).max(12).default([]),
});
export type JobInput = z.input<typeof jobInput>;

export const job = jobInput.extend({
  id: z.string().max(64),
  /** Last CV-vs-advert check (written by the server only). */
  match: z.custom<MatchResult>().optional(),
  /** Interview preparation (written by the server only). */
  interview: z.custom<InterviewPrep>().optional(),
  /** Application kit (R8.4): the tailored CV made with the letter and email (server only). */
  kit: z.object({ cvId: z.string().max(64), at: z.string() }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof job>;
