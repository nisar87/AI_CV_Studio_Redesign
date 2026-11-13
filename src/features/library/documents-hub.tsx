'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount } from '@/features/account/account-context';
import { jobsApi } from '@/features/jobs/api';
import { LetterList } from '@/features/letters/letter-list';
import type { Job } from '@/modules/jobs/schema';
import { cn } from '@/lib/cn';
import { MyCvs } from './my-cvs';

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'cvs', label: 'CVs' },
  { id: 'letters', label: 'Letters' },
] as const;
type TypeId = (typeof TYPES)[number]['id'];

/** Documents hub (spec §11.1): CVs and letters, filtered by type and by job. */
export function DocumentsHub() {
  const params = useSearchParams();
  const router = useRouter();
  const account = useAccount();
  const type: TypeId = (TYPES.find((t) => t.id === params.get('type'))?.id ?? 'all') as TypeId;
  const jobId = params.get('job') ?? '';
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    if (account.status !== 'signedIn') return;
    jobsApi.list().then(
      (r) => setJobs(r.jobs),
      () => setJobs([]),
    );
  }, [account.status]);
  const job = jobs.find((j) => j.id === jobId);
  const href = (t: TypeId, j = jobId) => {
    const q = new URLSearchParams();
    if (t !== 'all') q.set('type', t);
    if (j) q.set('job', j);
    const s = q.toString();
    return `/documents${s ? `?${s}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Document type" className="flex gap-2">
          {TYPES.map((t) => (
            <Link
              key={t.id}
              href={href(t.id)}
              aria-current={type === t.id ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold',
                type === t.id
                  ? 'bg-primary text-on-primary'
                  : 'border-line-strong bg-surface hover:bg-sunken border',
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {jobs.length > 0 && (
          <label className="text-ink-muted ml-auto flex items-center gap-2 text-sm font-semibold">
            For job
            <select
              className="border-line-strong bg-surface text-ink min-h-10 rounded-md border px-3 font-normal"
              value={jobId}
              onChange={(e) => router.replace(href(type, e.target.value))}
            >
              <option value="">Any job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.company ? ` — ${j.company}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {type !== 'letters' && (
        <section aria-labelledby="cvs-h" className="flex flex-col gap-4">
          {type === 'all' && (
            <h2 id="cvs-h" className="text-xl font-semibold">
              CVs
            </h2>
          )}
          <MyCvs
            only={job ? (d) => d.jobId === job.id || job.documentIds.includes(d.id) : undefined}
          />
        </section>
      )}
      {type !== 'cvs' && (
        <section aria-labelledby="letters-h" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="letters-h" className="text-xl font-semibold">
              Letters
            </h2>
          </div>
          <LetterList jobId={jobId || undefined} />
        </section>
      )}
    </div>
  );
}
