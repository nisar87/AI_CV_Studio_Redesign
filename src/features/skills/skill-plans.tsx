'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CircleCheck, CircleDashed, Lock, PenLine, Sparkles, Trash2 } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/chip';
import { TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/misc';
import { useAccount } from '@/features/account/account-context';
import { useEntitlements } from '@/features/account/entitlements';
import { JobsError, jobsApi } from '@/features/jobs/api';
import type { Job } from '@/modules/jobs/schema';
import { defaultSourceCv } from '@/modules/jobs/source-cv';
import { progressOf, type GapSkill, type SkillPlan, type StepStatus } from '@/modules/skills/gap';
import { getRepository } from '@/modules/storage/repository';
import { cn } from '@/lib/cn';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const j = (await r.json().catch(() => null)) as
    (T & { error?: undefined }) | { error: { message: string; reason?: string } } | null;
  if (!r.ok || !j || ('error' in j && j.error))
    throw new JobsError(
      (j && 'error' in j && j.error?.message) || 'That didn’t work. Please try again.',
      r.status,
    );
  return j as T;
}

const STATUS_LABEL: Record<StepStatus, string> = {
  todo: 'To do',
  learning: 'Learning',
  done: 'Done',
};
const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Skill gap and learning plan (R9.4): for one of your jobs or a role you type, the skills your CV
 * shows (with the lines that show them), what's partly there or missing, and what to learn first.
 */
export function SkillPlans() {
  const account = useAccount();
  const { ent, refresh } = useEntitlements();
  const params = useSearchParams();
  const [data, setData] = useState<{ plans: SkillPlan[]; max: number; enabled: boolean } | null>(
    null,
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ kind: 'job' | 'role'; jobId: string; role: string }>({
    kind: 'job',
    jobId: params.get('job') ?? '',
    role: '',
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; premium?: boolean } | null>(null);

  const repo = typeof window === 'undefined' ? null : getRepository();
  const source = useMemo(() => {
    const cvs = repo?.list() ?? [];
    const id = defaultSourceCv(cvs);
    return (id && repo?.get(id)) || null;
  }, [repo]);

  useEffect(() => {
    if (account.status !== 'signedIn') return;
    Promise.all([
      call<{ plans: SkillPlan[]; max: number; enabled: boolean }>('/api/skills'),
      jobsApi.list().then(
        (r) => r.jobs.filter((j) => j.stage !== 'closed'),
        () => [] as Job[],
      ),
    ]).then(
      ([d, j]) => {
        setData(d);
        setJobs(j);
        setOpenId(d.plans[0]?.id ?? null);
        setTarget((t) => ({
          ...t,
          kind: j.length ? t.kind : 'role',
          jobId: t.jobId && j.some((x) => x.id === t.jobId) ? t.jobId : (j[0]?.id ?? ''),
        }));
      },
      (e: Error) => setError(e.message),
    );
  }, [account.status]);

  if (account.status === 'signedOut')
    return (
      <div className="border-line bg-surface flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-lg font-semibold">Sign in to plan your next skills</p>
        <p className="text-ink-muted">
          See which skills your CV already shows for the role you want, and what to learn first.
        </p>
        <ButtonLink href="/signin?next=/skills">Sign in</ButtonLink>
      </div>
    );
  if (error) return <Banner tone="error" title={error} />;
  if (!data) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!data.enabled) return <Banner tone="info" title="Skill plans are switched off right now." />;

  const aiLocked = ent ? ent.limits['ai.action'] === 0 : false;
  const full = data.plans.length >= data.max;
  const ready =
    !!source && (target.kind === 'job' ? !!target.jobId : target.role.trim().length >= 2);

  const make = async () => {
    if (!source) return;
    setBusy(true);
    setProblem(null);
    try {
      const { plan } = await call<{ plan: SkillPlan }>('/api/skills', {
        method: 'POST',
        body: JSON.stringify({
          document: source,
          ...(target.kind === 'job' ? { jobId: target.jobId } : { role: target.role }),
        }),
      });
      setData({ ...data, plans: [plan, ...data.plans] });
      setOpenId(plan.id);
      refresh();
    } catch (e) {
      setProblem(
        e instanceof JobsError
          ? { message: e.message, premium: e.status === 402 }
          : { message: 'You seem to be offline. Please try again.' },
      );
    } finally {
      setBusy(false);
    }
  };

  const update = (p: SkillPlan) =>
    setData({ ...data, plans: data.plans.map((x) => (x.id === p.id ? p : x)) });
  const remove = async (p: SkillPlan) => {
    if (!confirm(`Delete the plan for “${p.role}”?`)) return;
    await call(`/api/skills/${p.id}`, { method: 'DELETE' }).catch(() => null);
    const rest = data.plans.filter((x) => x.id !== p.id);
    setData({ ...data, plans: rest });
    setOpenId(rest[0]?.id ?? null);
  };
  const open = data.plans.find((p) => p.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-8" data-testid="skill-plans">
      <section
        aria-labelledby="new-plan-h"
        className="border-line bg-surface flex flex-col gap-4 rounded-xl border p-5"
      >
        <h2 id="new-plan-h" className="text-lg font-semibold">
          Make a learning plan
        </h2>
        {!source ? (
          <p className="text-ink-muted">
            <Link href="/makeover" className="text-primary underline">
              Upload your CV
            </Link>{' '}
            first, so the plan can see what you already have.
          </p>
        ) : (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-semibold">What are you aiming for?</legend>
              {jobs.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="target"
                      className="accent-primary size-4"
                      checked={target.kind === 'job'}
                      onChange={() => setTarget({ ...target, kind: 'job' })}
                    />
                    <span>One of my jobs</span>
                  </label>
                  <select
                    aria-label="Job"
                    className="border-line-strong bg-surface h-11 min-w-0 flex-1 rounded-sm border px-2"
                    value={target.jobId}
                    disabled={target.kind !== 'job'}
                    onChange={(e) => setTarget({ ...target, jobId: e.target.value })}
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                        {j.company ? ` at ${j.company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="target"
                  className="accent-primary size-4"
                  checked={target.kind === 'role'}
                  onChange={() => setTarget({ ...target, kind: 'role' })}
                />
                <span>A role I’d like</span>
              </label>
              {target.kind === 'role' && (
                <TextField
                  label="The role"
                  hint="For example “Transport planner” or “Junior data analyst”."
                  maxLength={160}
                  value={target.role}
                  onChange={(e) => setTarget({ ...target, role: e.target.value })}
                />
              )}
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                icon={
                  aiLocked ? <Lock aria-hidden size={18} /> : <Sparkles aria-hidden size={18} />
                }
                loading={busy}
                disabled={!ready || busy || full}
                onClick={make}
              >
                Make my plan
              </Button>
              <p className="text-ink-muted text-sm">
                Reads your CV “{source.title || source.basics.name || 'Untitled'}”.
                {aiLocked ? ' Part of Premium.' : ' Uses one AI action.'}
              </p>
            </div>
            {full && (
              <p className="text-ink-muted text-sm">
                You can keep up to {data.max} plans. Delete one to make another.
              </p>
            )}
          </>
        )}
        {problem && (
          <Banner
            tone={problem.premium ? 'info' : 'error'}
            title={problem.message}
            onDismiss={() => setProblem(null)}
            action={
              problem.premium && ent?.features.sales ? (
                <ButtonLink href="/premium?next=/skills" size="sm">
                  See Premium
                </ButtonLink>
              ) : undefined
            }
          />
        )}
      </section>

      {data.plans.length > 1 && (
        <nav aria-label="Your plans" className="flex flex-wrap gap-2">
          {data.plans.map((p) => {
            const g = progressOf(p);
            return (
              <button
                key={p.id}
                type="button"
                aria-current={p.id === openId ? 'true' : undefined}
                className={cn(
                  'border-line rounded-full border px-3 py-1.5 text-sm',
                  p.id === openId ? 'bg-primary text-on-primary border-primary' : 'bg-surface',
                )}
                onClick={() => setOpenId(p.id)}
              >
                {p.role} · {g.done}/{g.total}
              </button>
            );
          })}
        </nav>
      )}

      {open ? (
        <PlanView key={open.id} plan={open} onChange={update} onDelete={() => remove(open)} />
      ) : (
        <div className="border-line bg-surface flex flex-col items-start gap-3 rounded-xl border p-6">
          <BookOpen aria-hidden size={26} className="text-primary" />
          <p className="text-lg font-semibold">No plans yet</p>
          <p className="text-ink-muted max-w-xl">
            Pick a job you track or type a role. You’ll see the skills your CV already shows — with
            the lines that show them — what’s missing, and the few things to learn first.
          </p>
        </div>
      )}
    </div>
  );
}

function SkillGroup({
  title,
  skills,
  documentId,
  tone,
}: {
  title: string;
  skills: GapSkill[];
  documentId: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  if (!skills.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">
        {title} <span className="text-ink-muted font-normal">({skills.length})</span>
      </h3>
      <ul className="flex flex-col gap-2">
        {skills.map((k) => (
          <li key={k.name} className="text-sm">
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge tone={tone}>{k.name}</Badge>
              {k.importance === 'core' && <span className="text-ink-muted text-xs">key skill</span>}
            </span>
            {k.note && <p className="text-ink-muted mt-1">{k.note}</p>}
            {k.evidence.map((e) => (
              <p key={e.ref + e.text} className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-ink-muted italic">“{e.text}”</span>
                {documentId && (
                  <Link
                    href={`/cv/${documentId}?focus=${encodeURIComponent(e.ref)}`}
                    className="text-primary text-xs font-semibold underline"
                  >
                    Show me
                  </Link>
                )}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanView({
  plan,
  onChange,
  onDelete,
}: {
  plan: SkillPlan;
  onChange: (p: SkillPlan) => void;
  onDelete: () => void;
}) {
  const [saving, setSaving] = useState<number | null>(null);
  const g = progressOf(plan);
  const set = async (i: number, status: StepStatus) => {
    const steps = plan.plan.map((s, n) => (n === i ? status : s.status));
    onChange({ ...plan, plan: plan.plan.map((s, n) => ({ ...s, status: steps[n]! })) });
    setSaving(i);
    try {
      const r = await call<{ plan: SkillPlan }>(`/api/skills/${plan.id}`, {
        method: 'PUT',
        body: JSON.stringify({ steps }),
      });
      onChange(r.plan);
    } catch {
      onChange(plan);
    } finally {
      setSaving(null);
    }
  };
  const by = (s: GapSkill['status']) => plan.skills.filter((k) => k.status === s);

  return (
    <article
      aria-labelledby="plan-h"
      className="border-line bg-surface flex flex-col gap-6 rounded-xl border p-5"
      data-testid="skill-plan"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="plan-h" className="text-xl font-semibold">
            {plan.role}
          </h2>
          <p className="text-ink-muted text-sm">Made {when(plan.createdAt)}</p>
        </div>
        <button
          type="button"
          className="text-ink-muted hover:bg-sunken hover:text-danger rounded-sm p-2"
          aria-label={`Delete the plan for “${plan.role}”`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden size={18} />
        </button>
      </header>
      {plan.summary && <p className="text-lg">{plan.summary}</p>}

      <div className="grid gap-6 md:grid-cols-3">
        <SkillGroup
          title="You already show"
          skills={by('have')}
          documentId={plan.documentId}
          tone="success"
        />
        <SkillGroup
          title="Partly there"
          skills={by('partly')}
          documentId={plan.documentId}
          tone="warning"
        />
        <SkillGroup title="To learn" skills={by('missing')} documentId="" tone="neutral" />
      </div>

      {plan.plan.length > 0 && (
        <section aria-labelledby="learn-h" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="learn-h" className="text-lg font-semibold">
              Learn first
            </h3>
            <span className="text-ink-muted text-sm" data-testid="plan-progress">
              {g.done} of {g.total} done
            </span>
          </div>
          <div
            className="bg-sunken h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Plan progress"
            aria-valuemin={0}
            aria-valuemax={g.total}
            aria-valuenow={g.done}
          >
            <div
              className="bg-primary h-full"
              style={{ width: `${g.total ? (g.done / g.total) * 100 : 0}%` }}
            />
          </div>
          <ol className="flex flex-col gap-3">
            {plan.plan.map((s, i) => (
              <li
                key={s.skill}
                className={cn(
                  'border-line flex flex-col gap-2 rounded-lg border p-4',
                  s.status === 'done' && 'bg-success-soft/40',
                )}
                data-testid="plan-step"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    {s.status === 'done' ? (
                      <CircleCheck aria-hidden size={18} className="text-success" />
                    ) : (
                      <CircleDashed aria-hidden size={18} className="text-ink-muted" />
                    )}
                    {i + 1}. {s.skill}
                    <span className="text-ink-muted text-sm font-normal">
                      · about {s.weeks} {s.weeks === 1 ? 'week' : 'weeks'}
                    </span>
                  </p>
                  <select
                    aria-label={`Progress on ${s.skill}`}
                    className="border-line-strong bg-surface h-10 rounded-sm border px-2 text-sm"
                    value={s.status}
                    disabled={saving === i}
                    onChange={(e) => set(i, e.target.value as StepStatus)}
                  >
                    {(Object.keys(STATUS_LABEL) as StepStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {STATUS_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                {s.why && <p className="text-sm">{s.why}</p>}
                {s.how && (
                  <p className="text-sm">
                    <span className="font-semibold">How: </span>
                    {s.how}
                  </p>
                )}
                {s.proof && (
                  <p className="text-ink-muted text-sm">
                    <span className="text-ink font-semibold">Show it on your CV: </span>
                    {s.proof}
                  </p>
                )}
                {s.status === 'done' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {plan.documentId && (
                      <ButtonLink
                        href={`/cv/${plan.documentId}`}
                        size="sm"
                        variant="secondary"
                        icon={<PenLine aria-hidden size={16} />}
                      >
                        Add it to my CV
                      </ButtonLink>
                    )}
                    <ButtonLink
                      href="/stories"
                      size="sm"
                      variant="secondary"
                      icon={<BookOpen aria-hidden size={16} />}
                    >
                      Write a story about it
                    </ButtonLink>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="text-ink-muted text-xs">
            Week estimates are rough, for someone learning alongside work. Add a skill to your CV
            only once it’s true.
          </p>
        </section>
      )}
    </article>
  );
}
