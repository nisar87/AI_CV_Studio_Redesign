/** Which CV a job's AI tools start from, from the person's CV list (newest first). */
export type CvSummary = { id: string; role: 'cv' | 'profile'; jobId?: string };

/**
 * Prefer the career profile, then the newest CV that is not a tailored copy for some job, and only
 * then anything at all. A tailored copy is shaped for one advert, so starting another job from it
 * would carry that slant over.
 */
export function defaultSourceCv(cvs: readonly CvSummary[]): string {
  return (
    cvs.find((c) => c.role === 'profile')?.id ?? cvs.find((c) => !c.jobId)?.id ?? cvs[0]?.id ?? ''
  );
}
