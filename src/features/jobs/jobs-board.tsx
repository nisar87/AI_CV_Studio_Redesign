'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Briefcase, Link2, Lock, Plus, X } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextArea, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useAccount } from '@/features/account/account-context';
import { useEntitlements } from '@/features/account/entitlements';
import type { JobFromUrl } from '@/modules/jobs/from-url';
import { JOB_STAGES, STAGE_LABEL, type Job, type JobStage } from '@/modules/jobs/schema';
import { JobsError, jobsApi } from './api';

const fmt = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Job tracker board: one column per stage (stacked on phones), move with a select. */
export function JobsBoard() {
  const account = useAccount();
  const { ent } = useEntitlements();
  const toast = useToast();
  const [data, setData] = useState<{ jobs: Job[]; max: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  // The Create sheet and Studio Home link here with ?new=1 to open the form straight away.
  const params = useSearchParams();
  const router = useRouter();
  const wantsNew = params.get('new') === '1';
  const adding = opened || wantsNew;
  const setAdding = (v: boolean) => {
    setOpened(v);
    if (!v && wantsNew) router.replace('/jobs', { scroll: false });
  };

  const load = useCallback(() => {
    jobsApi.list().then(setData, (e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (account.status === 'signedIn') load();
  }, [account.status, load]);

  const move = async (job: Job, stage: JobStage) => {
    setData((d) => d && { ...d, jobs: d.jobs.map((j) => (j.id === job.id ? { ...j, stage } : j)) });
    try {
      const next = await jobsApi.update(job.id, { stage });
      setData((d) => d && { ...d, jobs: d.jobs.map((j) => (j.id === job.id ? next : j)) });
      toast.show({ tone: 'success', message: `Moved to ${STAGE_LABEL[stage]}` });
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  if (account.status === 'loading')
    return <div className="skeleton h-72 rounded-lg" aria-busy="true" aria-label="Loading" />;
  if (account.status === 'signedOut')
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <Lock aria-hidden className="text-primary" />
        <h2 className="text-xl font-semibold">Sign in to track your applications</h2>
        <p className="text-ink-muted">
          Keep every job you’re interested in, where you are with it, and which CV you sent — on any
          device.
        </p>
        <ButtonLink href="/signin?next=/jobs">Sign in or create a free account</ButtonLink>
      </Card>
    );
  if (!data)
    return error ? (
      <Banner tone="error" title={error} />
    ) : (
      <div className="skeleton h-72 rounded-lg" aria-busy="true" aria-label="Loading" />
    );

  const full = data.max !== -1 && data.jobs.length >= data.max;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted" data-testid="jobs-count">
          {data.max === -1
            ? `${data.jobs.length} job${data.jobs.length === 1 ? '' : 's'}`
            : `${data.jobs.length} of ${data.max} jobs`}
        </p>
        {!adding && (
          <Button
            icon={<Plus aria-hidden size={18} />}
            onClick={() => setAdding(true)}
            disabled={full}
          >
            Add a job
          </Button>
        )}
      </div>
      {full && !adding && (
        <Banner
          tone="info"
          title={`Your plan tracks up to ${data.max} jobs at a time.`}
          action={
            ent?.features.sales ? (
              <ButtonLink href="/premium" size="sm">
                See Premium
              </ButtonLink>
            ) : undefined
          }
        >
          Remove a job you no longer need to add another.
        </Banner>
      )}
      {error && (
        <Banner tone="error" title="That didn’t work" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {adding && (
        <AddJob
          initialUrl={wantsNew ? (params.get('url') ?? '') : ''}
          canFetch={ent?.features.jobFromUrl !== false}
          onCancel={() => setAdding(false)}
          onAdded={(job) => {
            setAdding(false);
            setData((d) => d && { ...d, jobs: [job, ...d.jobs] });
            toast.show({ tone: 'success', message: 'Job added' });
          }}
        />
      )}
      {data.jobs.length === 0 && !adding ? (
        <div className="border-line-strong bg-surface flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
          <Briefcase aria-hidden size={28} className="text-primary" />
          <h2 className="text-xl font-semibold">No jobs yet</h2>
          <p className="text-ink-muted max-w-md">
            Add a job you’re interested in. Paste the advert too — it lets you check how well your
            CV matches and write a letter for it.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5" data-testid="jobs-board">
          {JOB_STAGES.map((stage) => {
            const jobs = data.jobs.filter((j) => j.stage === stage);
            return (
              <section
                key={stage}
                aria-labelledby={`stage-${stage}`}
                className="bg-sunken/60 flex flex-col gap-2 rounded-lg p-3"
                data-stage={stage}
              >
                <h2
                  id={`stage-${stage}`}
                  className="flex items-center justify-between px-1 text-sm font-semibold"
                >
                  {STAGE_LABEL[stage]}
                  <span className="text-ink-muted font-normal">{jobs.length}</span>
                </h2>
                {jobs.map((j) => (
                  <article
                    key={j.id}
                    className="border-line bg-surface rounded-md border p-3"
                    data-testid="job-card"
                  >
                    <Link
                      href={`/jobs/${j.id}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {j.title}
                    </Link>
                    {(j.company || j.location) && (
                      <p className="text-ink-muted text-sm">
                        {[j.company, j.location].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-ink-subtle mt-1 text-xs">
                      {j.appliedOn ? `Applied ${fmt(j.appliedOn)}` : `Added ${fmt(j.createdAt)}`}
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-ink-muted">Move to</span>
                      <select
                        className="border-line-strong bg-surface h-9 min-w-0 flex-1 rounded-sm border px-1.5"
                        value={j.stage}
                        aria-label={`Stage for ${j.title}`}
                        onChange={(e) => void move(j, e.target.value as JobStage)}
                      >
                        {JOB_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddJob({
  onCancel,
  onAdded,
  initialUrl = '',
  canFetch = true,
}: {
  onCancel: () => void;
  onAdded: (j: Job) => void;
  initialUrl?: string;
  canFetch?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState(initialUrl);
  const [advert, setAdvert] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // R9.5: fill the form from the advert's link (the person checks it, then saves).
  const [reading, setReading] = useState(false);
  const [read, setRead] = useState<{ host: string; via: JobFromUrl['via'] } | null>(null);
  const fill = async (link = url) => {
    if (!/^https?:\/\/\S+\.\S+/i.test(link.trim())) {
      setError('Paste the full link to the job advert, starting with https://');
      return;
    }
    setReading(true);
    setError(null);
    setRead(null);
    try {
      const job = await jobsApi.fromUrl(link.trim());
      setTitle(job.title);
      setCompany(job.company);
      setLocation(job.location);
      setUrl(job.url);
      setAdvert(job.advert);
      setRead({ host: new URL(job.url).hostname.replace(/^www\./, ''), via: job.via });
    } catch (err) {
      setError(err instanceof JobsError ? err.message : 'That didn’t work. Please try again.');
    } finally {
      setReading(false);
    }
  };
  const started = useRef(false);
  useEffect(() => {
    if (initialUrl && canFetch && !started.current) {
      started.current = true;
      void fill(initialUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl, canFetch]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAdded(await jobsApi.create({ title, company, location, url, advert }));
    } catch (err) {
      setError(err instanceof JobsError ? err.message : 'That didn’t work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Add a job">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add a job</h2>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Close"
            icon={<X aria-hidden size={18} />}
            onClick={onCancel}
          />
        </div>
        {canFetch && (
          <div className="bg-primary-soft/40 flex flex-col gap-2 rounded-lg p-3">
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="Link to the advert"
                containerClassName="min-w-0 flex-1"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void fill();
                  }
                }}
                maxLength={500}
              />
              <Button
                variant="secondary"
                icon={<Link2 aria-hidden size={18} />}
                loading={reading}
                disabled={reading || !url.trim()}
                onClick={() => fill()}
              >
                Fill in from the link
              </Button>
            </div>
            {read ? (
              <p className="text-sm" role="status" data-testid="job-read">
                Filled in from {read.host}
                {read.via === 'page'
                  ? ' — we couldn’t pick out the advert, so the whole page text is below. Trim it to the advert.'
                  : '. Check it before you save.'}
              </p>
            ) : (
              <p className="text-ink-muted text-sm">
                Paste a job’s link and we’ll fill in the title, company and advert for you.
              </p>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Job title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
          />
          <TextField
            label="Company"
            optional
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={160}
          />
          <TextField
            label="Location"
            optional
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
          />
          {!canFetch && (
            <TextField
              label="Link to the advert"
              optional
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={500}
            />
          )}
        </div>
        <TextArea
          label="The job advert"
          optional
          hint="Paste the advert text. It stays private and is used to check your CV against it and to write a letter."
          rows={5}
          value={advert}
          onChange={(e) => setAdvert(e.target.value)}
          maxLength={20000}
        />
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" loading={busy}>
            Save job
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
