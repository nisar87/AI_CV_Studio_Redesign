import type { Job } from '@/modules/jobs/schema';
import { healthCheck, type Finding } from '@/modules/quality/health';
import type { ResumeDocument } from '@/modules/resume/schema';
import type { DocumentSummary } from '@/modules/storage/repository';

/**
 * Studio Home rules (complete-studio-spec §11.2). Pure functions so they are testable and the
 * texts can later move to the Console: one "next best action", and a profile strength made of
 * specific, fixable items (never a vanity score).
 */
export type NextAction = {
  id: 'upload' | 'interview' | 'kit' | 'follow-up' | 'add-job' | 'profile' | 'fix' | 'design';
  title: string;
  body: string;
  href: string;
  cta: string;
};

const DAY = 86_400_000;
const days = (from: string, now: Date) => (now.getTime() - new Date(from).getTime()) / DAY;
const at = (j: Pick<Job, 'company' | 'title'>) =>
  j.company ? `${j.title} at ${j.company}` : j.title;

export function nextAction(
  documents: DocumentSummary[],
  jobs: Job[],
  opts: { now?: Date; profile?: ResumeDocument | null } = {},
): NextAction {
  const now = opts.now ?? new Date();
  const open = jobs.filter((j) => j.stage !== 'closed');
  const newest = <T extends { updatedAt: string }>(xs: T[]) =>
    [...xs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  if (documents.length === 0)
    return {
      id: 'upload',
      title: 'Upload your CV',
      body: 'See it in new designs in under a minute — in your own words. Or start from scratch.',
      href: '/makeover',
      cta: 'Upload my CV',
    };
  const interview = newest(open.filter((j) => j.stage === 'interview'));
  if (interview)
    return {
      id: 'interview',
      title: `Practise for your interview: ${at(interview)}`,
      body: 'Likely questions for this job, with answer notes from your own CV.',
      href: `/jobs/${interview.id}#interview`,
      cta: 'Practise now',
    };
  const needsKit = newest(
    open.filter((j) => j.stage === 'saved' && !j.kit && (!j.letter || !j.documentIds.length)),
  );
  if (needsKit)
    return {
      id: 'kit',
      title: `Create your application kit: ${at(needsKit)}`,
      body: 'A CV tailored to this job, a cover letter and a short email — reviewed together.',
      href: `/jobs/${needsKit.id}#kit`,
      cta: 'Create the kit',
    };
  const followUp = newest(
    open.filter((j) => j.stage === 'applied' && j.appliedOn && days(j.appliedOn, now) >= 7),
  );
  if (followUp)
    return {
      id: 'follow-up',
      title: `Follow up: ${at(followUp)}`,
      body: `You applied ${Math.floor(days(followUp.appliedOn, now))} days ago. A short, polite follow-up often gets a reply.`,
      href: `/jobs/${followUp.id}`,
      cta: 'Open the job',
    };
  if (jobs.length === 0)
    return {
      id: 'add-job',
      title: 'Add a job you want',
      body: 'Paste the advert and get a CV tailored to it, a cover letter and interview questions.',
      href: '/jobs?new=1',
      cta: 'Add a job',
    };
  if (!documents.some((d) => d.role === 'profile'))
    return {
      id: 'profile',
      title: 'Set up your career profile',
      body: 'One master record of everything you have done. New CVs and letters start from it.',
      href: '/profile',
      cta: 'Set up my profile',
    };
  const fixes = opts.profile
    ? healthCheck(opts.profile).findings.filter((f) => f.severity === 'fix')
    : [];
  if (opts.profile && fixes[0])
    return {
      id: 'fix',
      title: fixes[0].title,
      body: fixes[0].detail,
      href: findingHref(opts.profile.id, fixes[0]),
      cta: 'Fix it',
    };
  const last = newest(documents)!;
  return {
    id: 'design',
    title: 'Describe your dream design',
    body: 'Tell us the look you imagine — columns, colours, headings — and see your CV in it.',
    href: `/cv/${last.id}?tab=design`,
    cta: 'Try it',
  };
}

export function findingHref(docId: string, f: Finding): string {
  return `/cv/${docId}${f.ref ? `?focus=${encodeURIComponent(f.ref)}` : ''}`;
}

/** Profile strength: share of checks passed, and every missing item as a one-click fix. */
export function profileStrength(doc: ResumeDocument): {
  percent: number;
  items: { title: string; href: string; severity: Finding['severity'] }[];
} {
  const r = healthCheck(doc);
  const total = r.passed.length + r.findings.length;
  return {
    percent: total ? Math.round((r.passed.length / total) * 100) : 0,
    items: r.findings.map((f) => ({
      title: f.title,
      href: findingHref(doc.id, f),
      severity: f.severity,
    })),
  };
}
