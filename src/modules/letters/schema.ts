import { z } from 'zod';

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
