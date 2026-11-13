import { z } from 'zod';
import { LETTER_TYPE_IDS } from './types';

/** A cover letter for one job (stored on the job). Text is the person's (AI drafts are guarded). */
export const letter = z.object({
  greeting: z.string().max(80).default('Dear Hiring Manager,'),
  paragraphs: z.array(z.string().max(1500)).max(8).default([]),
  closing: z.string().max(80).default('Kind regards,'),
  tone: z.enum(['warm', 'formal']).default('warm'),
  /** Covering email to send the CV and letter with. */
  email: z
    .object({ subject: z.string().max(160).default(''), body: z.string().max(1500).default('') })
    .default({ subject: '', body: '' }),
  /** CV whose design and contact details the letter uses. */
  documentId: z.string().max(64).default(''),
  updatedAt: z.string().default(''),
});
export type Letter = z.infer<typeof letter>;

/**
 * A letter from the letter library (R8.2), kept in the account (users/{uid}/letters/{id}).
 * Job cover letters stay on their job; these are the general cover letter and the other types.
 */
export const savedLetterInput = z.object({
  type: z.enum(LETTER_TYPE_IDS),
  title: z.string().trim().max(160).default(''),
  /** Recipient block, one line each (name, organisation, address). */
  to: z.array(z.string().max(160)).max(5).default([]),
  subject: z.string().max(160).default(''),
  /** The person's answers to the type's questions, by question id. */
  answers: z.record(z.string().max(40), z.string().max(1500)).default({}),
  greeting: z.string().max(80).default('Dear Hiring Manager,'),
  paragraphs: z.array(z.string().max(1500)).max(8).default([]),
  closing: z.string().max(80).default('Kind regards,'),
  tone: z.enum(['warm', 'formal']).default('warm'),
  /** CV whose design and contact details the letter uses. */
  documentId: z.string().max(64).default(''),
  /** Optional link to a tracked job. */
  jobId: z.string().max(64).default(''),
});
export type SavedLetterInput = z.input<typeof savedLetterInput>;

export const savedLetter = savedLetterInput.extend({
  id: z.string().max(64),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SavedLetter = z.infer<typeof savedLetter>;

/** Letters an account can keep. */
export const MAX_LETTERS = 100;
