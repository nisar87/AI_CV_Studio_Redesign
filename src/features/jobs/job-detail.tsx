'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextArea, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { CheckboxField } from '@/features/editor/fields';
import { JOB_STAGES, STAGE_LABEL, type Job, type JobStage } from '@/modules/jobs/schema';
import { getRepository } from '@/modules/storage/repository';
import { jobsApi } from './api';
import { JobTools } from './job-tools';

type Draft = Pick<
  Job,
  | 'title'
  | 'company'
  | 'location'
  | 'url'
  | 'advert'
  | 'stage'
  | 'notes'
  | 'appliedOn'
  | 'documentIds'
>;
const pick = (j: Job): Draft => ({
  title: j.title,
  company: j.company,
  location: j.location,
  url: j.url,
  advert: j.advert,
  stage: j.stage,
  notes: j.notes,
  appliedOn: j.appliedOn,
  documentIds: j.documentIds,
});

/** CV list from this browser's repository (updates when CVs sync in). */
function useCvList() {
  const repo = typeof window === 'undefined' ? null : getRepository();
  const version = useSyncExternalStore(
    (cb) => repo?.subscribe(cb) ?? (() => {}),
    () => (repo ? JSON.stringify(repo.list().map((d) => d.id + d.updatedAt)) : ''),
    () => '',
  );
  return useMemo(() => (repo ? repo.list() : []), [repo, version]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function JobDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const cvs = useCvList();
  const [job, setJob] = useState<Job | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    jobsApi.get(id).then(
      (j) => {
        setJob(j);
        setDraft(pick(j));
      },
      (e: Error) => setError(e.message),
    );
  }, [id]);

  if (!job || !draft)
    return error ? (
      <Banner tone="error" title={error} action={<Link href="/jobs">Back to jobs</Link>} />
    ) : (
      <div className="skeleton h-96 rounded-lg" aria-busy="true" aria-label="Loading" />
    );

  const dirty = JSON.stringify(pick(job)) !== JSON.stringify(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => d && { ...d, [k]: v });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await jobsApi.update(job.id, draft);
      setJob(next);
      setDraft(pick(next));
      toast.show({ tone: 'success', message: 'Saved' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove “${job.title}” from your jobs?`)) return;
    try {
      await jobsApi.remove(job.id);
      toast.show({ tone: 'success', message: 'Job removed' });
      router.push('/jobs');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <Link href="/jobs" className="text-primary inline-flex items-center gap-1.5 font-semibold">
        <ArrowLeft aria-hidden size={18} /> All jobs
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-tight font-semibold tracking-tight">
            {job.title}
          </h1>
          <p className="text-ink-muted">
            {[job.company, job.location].filter(Boolean).join(' · ')}
          </p>
        </div>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1.5 font-semibold"
          >
            Open the advert <ExternalLink aria-hidden size={16} />
          </a>
        )}
      </div>
      {error && (
        <Banner tone="error" title="That didn’t work" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-lg font-semibold">Where you are</h2>
            <div role="radiogroup" aria-label="Stage" className="flex flex-wrap gap-2">
              {JOB_STAGES.map((s: JobStage) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={draft.stage === s}
                  onClick={() => set('stage', s)}
                  className={
                    draft.stage === s
                      ? 'border-primary bg-primary-soft text-primary min-h-10 rounded-full border-2 px-3.5 text-sm font-semibold'
                      : 'border-line-strong bg-surface hover:bg-sunken min-h-10 rounded-full border px-3.5 text-sm font-semibold'
                  }
                >
                  {STAGE_LABEL[s]}
                </button>
              ))}
            </div>
            <TextField
              label="Applied on"
              optional
              type="date"
              value={draft.appliedOn}
              onChange={(e) => set('appliedOn', e.target.value)}
              containerClassName="max-w-[220px]"
            />
            <TextArea
              label="Notes"
              optional
              rows={4}
              hint="Contacts, interview times, what to follow up."
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={4000}
            />
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-lg font-semibold">CVs used for this job</h2>
            {cvs.length === 0 ? (
              <p className="text-ink-muted text-sm">
                You have no CVs yet.{' '}
                <Link href="/start" className="text-primary font-semibold">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-1" data-testid="job-cvs">
                {cvs.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <CheckboxField
                      label={c.title || c.name || 'Untitled CV'}
                      checked={draft.documentIds.includes(c.id)}
                      onChange={(v) =>
                        set(
                          'documentIds',
                          v
                            ? [...draft.documentIds, c.id].slice(0, 10)
                            : draft.documentIds.filter((x) => x !== c.id),
                        )
                      }
                    />
                    <Link
                      href={`/cv/${c.id}`}
                      className="text-primary shrink-0 text-sm font-semibold"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <JobTools
            job={job}
            onJobChange={(j) => {
              setJob(j);
              setDraft(pick(j));
            }}
          />
        </div>

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">The job</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Job title"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={160}
            />
            <TextField
              label="Company"
              optional
              value={draft.company}
              onChange={(e) => set('company', e.target.value)}
              maxLength={160}
            />
            <TextField
              label="Location"
              optional
              value={draft.location}
              onChange={(e) => set('location', e.target.value)}
              maxLength={120}
            />
            <TextField
              label="Link to the advert"
              optional
              type="url"
              value={draft.url}
              onChange={(e) => set('url', e.target.value)}
              maxLength={500}
            />
          </div>
          <TextArea
            label="The job advert"
            optional
            rows={14}
            hint="Paste the full advert. It’s used to check your CV against the job and to write a letter."
            value={draft.advert}
            onChange={(e) => set('advert', e.target.value)}
            maxLength={20000}
          />
          <Button
            variant="ghost"
            icon={<Trash2 aria-hidden size={18} />}
            onClick={remove}
            className="self-start"
          >
            Remove this job
          </Button>
        </Card>
      </div>

      <div className="border-line bg-surface/95 fixed right-0 bottom-[var(--shell-bottom,0px)] left-[var(--shell-left,0px)] z-20 border-t backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-end gap-3 px-4 py-3 md:px-8">
          <span className="text-ink-muted text-sm" aria-live="polite">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(pick(job))}>
            Discard
          </Button>
          <Button disabled={!dirty} loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
