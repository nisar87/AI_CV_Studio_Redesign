'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Globe,
  MessagesSquare,
  Plus,
  Wand2,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useAccount } from '@/features/account/account-context';
import { jobsApi } from '@/features/jobs/api';
import { DocumentPreview } from '@/features/preview/document-preview';
import { JOB_STAGES, type Job } from '@/modules/jobs/schema';
import type { ResumeDocument } from '@/modules/resume/schema';
import { getRepository } from '@/modules/storage/repository';
import { nextAction, profileStrength } from '@/modules/studio/next-action';

const STAGE_LABEL: Record<(typeof JOB_STAGES)[number], string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  closed: 'Closed',
};

function useDocuments() {
  const repo = getRepository();
  const [list, setList] = useState(() => repo.list());
  useEffect(() => repo.subscribe(() => setList(repo.list())), [repo]);
  return list;
}

function Thumb({ doc, label }: { doc: ResumeDocument; label: string }) {
  return (
    <Link
      href={`/cv/${doc.id}`}
      aria-label={label}
      className="bg-surface shadow-page ring-primary block overflow-hidden rounded-[4px] hover:ring-2"
    >
      <div className="pointer-events-none">
        <DocumentPreview
          doc={doc}
          firstPageOnly
          decorative
          lazy
          debounceMs={0}
          title={`Thumbnail of ${doc.title}`}
        />
      </div>
    </Link>
  );
}

function Ring({ percent }: { percent: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 80 80"
      className="size-24 shrink-0"
      role="img"
      aria-label={`Profile ${percent}% complete`}
    >
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-sunken)" strokeWidth="8" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(c * percent) / 100} ${c}`}
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="46" textAnchor="middle" className="fill-ink text-[18px] font-semibold">
        {percent}%
      </text>
    </svg>
  );
}

/** Studio Home (complete-studio-spec §11.2): what you have, and the one thing to do next. */
export function StudioHome() {
  const account = useAccount();
  const signedIn = account.status === 'signedIn';
  const list = useDocuments();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    jobsApi.list().then(
      (r) => setJobs(r.jobs),
      () => setJobs([]),
    );
  }, [signedIn]);

  const repo = getRepository();
  const profileSummary = list.find((d) => d.role === 'profile');
  const profile = useMemo(
    () => (profileSummary ? repo.get(profileSummary.id) : null),
    // updatedAt changes on every save, so the profile is re-read only when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileSummary?.id, profileSummary?.updatedAt],
  );
  const cvs = list.filter((d) => d.role !== 'profile');
  const latest = cvs[0] ?? list[0];
  const latestDoc = useMemo(
    () => (latest ? repo.get(latest.id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latest?.id, latest?.updatedAt],
  );
  const rowKey = cvs
    .slice(0, 5)
    .map((c) => c.id + c.updatedAt)
    .join();
  const row = useMemo(
    () =>
      cvs
        .slice(0, 5)
        .map((s) => repo.get(s.id))
        .filter((d): d is ResumeDocument => d !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowKey],
  );
  const action = nextAction(list, jobs ?? [], { profile });
  const strength = profile ? profileStrength(profile) : null;
  const name = account.user?.name?.split(' ')[0];

  const counts = JOB_STAGES.filter((s) => s !== 'closed').map((s) => ({
    stage: s,
    n: (jobs ?? []).filter((j) => j.stage === s).length,
  }));

  const explore = [
    !jobs?.length && {
      href: '/jobs?new=1',
      icon: Briefcase,
      title: 'Tailor your CV to a job',
      body: 'Paste an advert and see how well you match.',
    },
    latest && {
      href: `/cv/${latest.id}?tab=design`,
      icon: Wand2,
      title: 'Describe your dream design',
      body: 'Say what you want and see it on your own CV.',
    },
    {
      href: '/portfolio',
      icon: Globe,
      title: 'See your CV as a website',
      body: 'A page to share, made from your CV.',
    },
    {
      href: '/coach',
      icon: MessagesSquare,
      title: 'Mock interview',
      body: 'Practise the questions you’re likely to get.',
    },
  ]
    .filter((t): t is Exclude<typeof t, false | undefined | null | ''> => Boolean(t))
    .slice(0, 3);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-10 px-4 py-8 md:px-8 md:py-10">
      <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
        {name ? `Welcome back, ${name}` : 'Your studio'}
      </h1>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {latestDoc ? (
          <section aria-labelledby="continue" className="flex flex-col gap-3">
            <h2
              id="continue"
              className="text-ink-muted text-sm font-semibold tracking-wide uppercase"
            >
              Continue
            </h2>
            <div className="flex gap-4">
              <div className="w-36 shrink-0 sm:w-44">
                <Thumb doc={latestDoc} label={`Open ${latestDoc.title}`} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                <p className="line-clamp-3 text-lg font-semibold break-words">{latestDoc.title}</p>
                <ButtonLink
                  href={`/cv/${latestDoc.id}`}
                  icon={<ArrowRight aria-hidden size={18} />}
                  className="self-start"
                >
                  Continue editing
                </ButtonLink>
              </div>
            </div>
          </section>
        ) : null}

        <section
          aria-labelledby="next"
          data-testid="next-action"
          data-action={action.id}
          className="bg-primary-soft/60 border-primary/20 flex flex-col justify-center gap-3 rounded-xl border p-6"
        >
          <h2 id="next" className="text-primary text-sm font-semibold tracking-wide uppercase">
            Next best step
          </h2>
          <p className="font-display text-2xl font-semibold">{action.title}</p>
          <p className="text-ink-muted">{action.body}</p>
          <ButtonLink href={action.href} className="self-start">
            {action.cta}
          </ButtonLink>
        </section>
      </div>

      <section aria-labelledby="docs" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="docs" className="text-lg font-semibold">
            Your documents
          </h2>
          <Link href="/documents" className="text-primary text-sm font-semibold hover:underline">
            See all
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <li>
            <Link
              href="/start"
              className="border-line-strong text-primary hover:bg-primary-soft/40 flex aspect-[210/297] flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed font-semibold"
            >
              <Plus aria-hidden size={24} /> New
            </Link>
          </li>
          {row.map((d) => (
            <li key={d.id} className="flex flex-col gap-2">
              <Thumb doc={d} label={`Open ${d.title}`} />
              <span className="truncate text-sm font-semibold">{d.title}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section
          aria-labelledby="jobs"
          className="border-line bg-surface flex flex-col gap-4 rounded-xl border p-5"
        >
          <div className="flex items-center justify-between">
            <h2 id="jobs" className="text-lg font-semibold">
              Your jobs
            </h2>
            <Link href="/jobs" className="text-primary text-sm font-semibold hover:underline">
              Open tracker
            </Link>
          </div>
          {!signedIn ? (
            <p className="text-ink-muted">
              <Link href="/signin" className="text-primary font-semibold hover:underline">
                Sign in
              </Link>{' '}
              to track the jobs you’re going for.
            </p>
          ) : jobs === null ? (
            <Skeleton className="h-16 w-full rounded-md" />
          ) : jobs.length === 0 ? (
            <p className="text-ink-muted">
              No jobs yet.{' '}
              <Link href="/jobs?new=1" className="text-primary font-semibold hover:underline">
                Add one you want
              </Link>{' '}
              and get a CV tailored to it.
            </p>
          ) : (
            <ul className="grid grid-cols-4 gap-2" aria-label="Pipeline">
              {counts.map((c) => (
                <li key={c.stage} className="bg-sunken flex flex-col items-center rounded-md py-3">
                  <span className="text-2xl font-semibold">{c.n}</span>
                  <span className="text-ink-muted text-sm">{STAGE_LABEL[c.stage]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="strength"
          className="border-line bg-surface flex flex-col gap-4 rounded-xl border p-5"
        >
          <h2 id="strength" className="text-lg font-semibold">
            Profile strength
          </h2>
          {strength ? (
            <div className="flex items-start gap-5">
              <Ring percent={strength.percent} />
              {strength.items.length ? (
                <ul className="flex min-w-0 flex-col gap-2">
                  {strength.items.slice(0, 4).map((i) => (
                    <li key={i.title}>
                      <Link href={i.href} className="text-primary font-semibold hover:underline">
                        {i.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted flex items-center gap-2">
                  <CheckCircle2 aria-hidden size={18} className="text-primary" /> Nothing missing.
                  Nice work.
                </p>
              )}
            </div>
          ) : (
            <p className="text-ink-muted">
              Your career profile holds everything about you once, so every CV and letter starts
              complete.{' '}
              <Link href="/profile" className="text-primary font-semibold hover:underline">
                Set it up
              </Link>
              .
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="explore" className="flex flex-col gap-3">
        <h2 id="explore" className="text-lg font-semibold">
          Explore
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {explore.map((t) => (
            <li key={t.title}>
              <Link
                href={t.href}
                className="border-line bg-surface hover:border-primary flex h-full flex-col gap-2 rounded-xl border p-5"
              >
                <t.icon aria-hidden size={22} className="text-primary" />
                <span className="font-semibold">{t.title}</span>
                <span className="text-ink-muted text-sm">{t.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
