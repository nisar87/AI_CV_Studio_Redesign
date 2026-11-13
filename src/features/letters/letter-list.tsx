'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Briefcase, FileText, Plus } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useAccount } from '@/features/account/account-context';
import { useEntitlements } from '@/features/account/entitlements';
import { jobsApi } from '@/features/jobs/api';
import type { Job } from '@/modules/jobs/schema';
import type { SavedLetter } from '@/modules/letters/schema';
import { LETTER_TYPE, LETTER_TYPES } from '@/modules/letters/types';
import { lettersApi } from './api';

type Row = {
  key: string;
  href: string;
  title: string;
  kind: string;
  updatedAt: string;
  job: boolean;
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Letters in the Documents hub: library letters and the cover letters written on jobs. */
export function LetterList({ jobId }: { jobId?: string }) {
  const account = useAccount();
  const { ent } = useEntitlements();
  const [data, setData] = useState<{ letters: SavedLetter[]; jobs: Job[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (account.status !== 'signedIn') return;
    Promise.all([lettersApi.list(), jobsApi.list()]).then(
      ([l, j]) => setData({ letters: l.letters, jobs: j.jobs }),
      (e: Error) => setError(e.message),
    );
  }, [account.status]);

  if (account.status === 'signedOut')
    return (
      <p className="text-ink-muted">
        <Link href="/signin?next=/documents" className="text-primary font-semibold hover:underline">
          Sign in
        </Link>{' '}
        to write cover letters and other letters in the same design as your CV.
      </p>
    );
  if (error) return <Banner tone="error" title={error} />;
  if (!data) return <Skeleton className="h-28 w-full rounded-md" />;

  const rows: Row[] = [
    ...data.letters
      .filter((l) => !jobId || l.jobId === jobId)
      .map((l) => ({
        key: l.id,
        href: `/letters/${l.id}`,
        title: l.title || l.subject || LETTER_TYPE[l.type].title,
        kind: LETTER_TYPE[l.type].title,
        updatedAt: l.updatedAt,
        job: false,
      })),
    ...data.jobs
      .filter((j) => j.letter?.paragraphs.some((p) => p.trim()) && (!jobId || j.id === jobId))
      .map((j) => ({
        key: `job-${j.id}`,
        href: `/jobs/${j.id}`,
        title: `${j.title}${j.company ? ` at ${j.company}` : ''}`,
        kind: 'Cover letter for a job',
        updatedAt: j.letter?.updatedAt || j.updatedAt,
        job: true,
      })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 0 ? (
        <ul
          className="border-line bg-surface divide-line divide-y rounded-xl border"
          aria-label="Letters"
        >
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="hover:bg-sunken flex items-center gap-3 px-4 py-3">
                <span className="bg-primary-soft text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-md">
                  {r.job ? <Briefcase aria-hidden size={18} /> : <FileText aria-hidden size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className="text-ink-muted block text-sm">
                    {r.kind} · {when(r.updatedAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">
          {jobId ? 'No letters for this job yet.' : 'No letters yet. Pick one to start:'}
        </p>
      )}
      {!jobId && ent?.features.letters !== false && (
        <ul className="flex flex-wrap gap-2" aria-label="Start a letter">
          {LETTER_TYPES.filter((t) => !ent?.hiddenLetterTypes.includes(t.id)).map((t) => (
            <li key={t.id}>
              <Link
                href={`/letters/new?type=${t.id}`}
                className="border-line-strong bg-surface hover:bg-sunken inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold"
              >
                <Plus aria-hidden size={14} /> {t.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {jobId && (
        <ButtonLink href={`/jobs/${jobId}`} variant="secondary" className="self-start">
          Write the cover letter on the job
        </ButtonLink>
      )}
    </div>
  );
}
