'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Briefcase, MessagesSquare, Target } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useAccount } from '@/features/account/account-context';
import { jobsApi } from '@/features/jobs/api';
import type { Job } from '@/modules/jobs/schema';

/** Coach (R8): the interview practice and job match tools that exist today, per job. */
export function CoachHome() {
  const account = useAccount();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  useEffect(() => {
    if (account.status !== 'signedIn') return;
    jobsApi.list().then(
      (r) => setJobs(r.jobs.filter((j) => j.stage !== 'closed')),
      () => setJobs([]),
    );
  }, [account.status]);

  if (account.status === 'signedOut')
    return (
      <div className="border-line bg-surface flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-lg font-semibold">Sign in to practise for your interviews</p>
        <p className="text-ink-muted">
          Coaching works from the jobs you track, so the questions fit the role.
        </p>
        <ButtonLink href="/signin?next=/coach">Sign in</ButtonLink>
      </div>
    );
  if (jobs === null) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (jobs.length === 0)
    return (
      <div className="border-line bg-surface flex flex-col items-start gap-3 rounded-xl border p-6">
        <Briefcase aria-hidden size={26} className="text-primary" />
        <p className="text-lg font-semibold">Add a job you want to start practising</p>
        <p className="text-ink-muted">
          Paste the advert and you’ll get likely interview questions, tips, and a check of how well
          your CV matches.
        </p>
        <ButtonLink href="/jobs?new=1">Add a job</ButtonLink>
      </div>
    );
  return (
    <ul className="flex flex-col gap-3" aria-label="Your jobs">
      {jobs.map((j) => (
        <li
          key={j.id}
          className="border-line bg-surface flex flex-wrap items-center gap-4 rounded-xl border p-5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{j.title}</p>
            <p className="text-ink-muted truncate text-sm">{j.company || 'Company not set'}</p>
          </div>
          <Link
            href={`/jobs/${j.id}#interview`}
            className="text-primary hover:bg-primary-soft inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold"
          >
            <MessagesSquare aria-hidden size={18} />
            {j.interview ? 'Review interview prep' : 'Practise interview'}
          </Link>
          <Link
            href={`/jobs/${j.id}`}
            className="text-primary hover:bg-primary-soft inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold"
          >
            <Target aria-hidden size={18} /> Check my match
          </Link>
        </li>
      ))}
    </ul>
  );
}
