'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Info, Lock, ScanSearch } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { useAccount } from '@/features/account/account-context';
import { remaining, useEntitlements } from '@/features/account/entitlements';
import { jobsApi } from '@/features/jobs/api';
import type { Job } from '@/modules/jobs/schema';
import type { AtsCheck, AtsReport } from '@/modules/quality/ats';
import type { ResumeDocument } from '@/modules/resume/schema';
import { HealthPanel } from './health-panel';

const ICON = { pass: CircleCheck, 'needs-work': CircleAlert, info: Info } as const;
const TONE = { pass: 'text-success', 'needs-work': 'text-danger', info: 'text-primary' } as const;
const LABEL = { pass: 'Pass', 'needs-work': 'Needs work', info: 'Good to know' } as const;

/**
 * The editor's Check tab (spec §11.3): the CV health check and the ATS check together. Every
 * finding has a "Show me" that opens the field, or the Design tab for layout fixes.
 */
export function CheckPanel({
  doc,
  pages,
  onShow,
  onDesign,
}: {
  doc: ResumeDocument;
  pages?: number;
  onShow: (ref: string) => void;
  onDesign: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 pb-6">
      <HealthPanel doc={doc} pages={pages} onShow={onShow} />
      <AtsPanel doc={doc} onShow={onShow} onDesign={onDesign} />
    </div>
  );
}

function AtsPanel({
  doc,
  onShow,
  onDesign,
}: {
  doc: ResumeDocument;
  onShow: (ref: string) => void;
  onDesign: () => void;
}) {
  const account = useAccount();
  const { ent, refresh } = useEntitlements();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState(doc.jobId ?? '');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<AtsReport | null>(null);
  const [problem, setProblem] = useState<{ message: string; premium?: boolean } | null>(null);
  const signedIn = account.status === 'signedIn';
  const premium = ent?.plan === 'premium';
  useEffect(() => {
    if (!signedIn) return;
    jobsApi.list().then(
      (r) => setJobs(r.jobs.filter((j) => j.advert.trim().length >= 80)),
      () => setJobs([]),
    );
  }, [signedIn]);
  if (ent && !ent.features.atsCheck) return null;
  const left = ent ? remaining(ent, 'ats.check') : 0;

  const run = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await fetch('/api/quality/ats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: doc, jobId: premium ? jobId : '' }),
      });
      const j = (await r.json().catch(() => null)) as {
        report?: AtsReport;
        error?: { message: string };
      } | null;
      if (!r.ok || !j?.report) {
        setProblem({
          message: j?.error?.message ?? 'We couldn’t check this CV just now.',
          premium: r.status === 402,
        });
        return;
      }
      setReport(j.report);
      refresh();
    } catch {
      setProblem({ message: 'You seem to be offline. Please try again.' });
    } finally {
      setBusy(false);
    }
  };
  const go = (c: AtsCheck) => (c.where === 'design' ? onDesign() : c.where && onShow(c.where));
  const toFix = report?.checks.filter((c) => c.status === 'needs-work').length ?? 0;

  return (
    <section
      aria-labelledby="ats-h"
      className="border-line bg-surface shadow-1 flex flex-col gap-4 rounded-lg border p-5"
      data-testid="ats"
    >
      <div>
        <h2 id="ats-h" className="flex items-center gap-2 font-semibold">
          <ScanSearch aria-hidden size={18} className="text-primary" /> ATS check
        </h2>
        <p className="text-ink-muted text-sm">
          Many employers screen CVs with software first. We make your PDF, read it back the way that
          software does, and tell you what it sees.
        </p>
      </div>

      {!signedIn ? (
        <p className="text-ink-muted text-sm">
          <Link
            href={`/signin?next=/cv/${doc.id}?tab=check`}
            className="text-primary font-semibold"
          >
            Sign in
          </Link>{' '}
          to run the ATS check.
        </p>
      ) : (
        <>
          {jobs.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              <span className="flex items-center gap-1.5">
                Check keywords for a job {!premium && <Lock aria-hidden size={14} />}
              </span>
              <select
                className="border-line-strong bg-surface min-h-11 rounded-md border px-3 text-[15px] font-normal disabled:opacity-60"
                value={premium ? jobId : ''}
                disabled={!premium}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">No job — readability only</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                    {j.company ? ` — ${j.company}` : ''}
                  </option>
                ))}
              </select>
              {!premium && (
                <span className="text-ink-muted font-normal">
                  Job keywords are part of{' '}
                  <Link href="/premium" className="text-primary font-semibold">
                    Premium
                  </Link>
                  .
                </span>
              )}
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={report ? 'secondary' : 'primary'}
              icon={<ScanSearch aria-hidden size={18} />}
              loading={busy}
              disabled={busy || (ent !== null && left === 0)}
              onClick={run}
            >
              {report ? 'Check again' : 'Run the ATS check'}
            </Button>
            {ent && Number.isFinite(left) && (
              <span className="text-ink-muted text-sm" data-testid="ats-left">
                {left} of {ent.limits['ats.check']} left this month
              </span>
            )}
          </div>
        </>
      )}

      {problem && (
        <Banner
          tone="error"
          title={problem.message}
          action={
            problem.premium ? (
              <ButtonLink href="/premium" size="sm">
                See Premium
              </ButtonLink>
            ) : undefined
          }
        />
      )}

      {report && (
        <div className="flex flex-col gap-4" aria-live="polite" data-testid="ats-report">
          <p className="font-semibold">
            {toFix
              ? `${toFix} thing${toFix === 1 ? '' : 's'} to fix for screening software`
              : 'Screening software reads this CV well.'}
          </p>
          <ul className="flex flex-col gap-3">
            {report.checks.map((c) => {
              const Icon = ICON[c.status];
              return (
                <li
                  key={c.id}
                  className="flex items-start gap-2.5"
                  data-check={c.id}
                  data-status={c.status}
                >
                  <Icon aria-hidden size={20} className={`${TONE[c.status]} mt-0.5 shrink-0`} />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span className="sr-only">{LABEL[c.status]}: </span>
                      {c.title}
                    </p>
                    <p className="text-ink-muted text-sm">{c.detail}</p>
                    {c.examples && c.examples.length > 0 && (
                      <ul className="text-ink-muted mt-1 text-sm">
                        {c.examples.map((e) => (
                          <li key={e} className="truncate">
                            “{e}”
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.fix && <p className="mt-1 text-sm">{c.fix}</p>}
                    {c.where && c.status !== 'pass' && (
                      <button
                        type="button"
                        onClick={() => go(c)}
                        className="text-primary mt-1 text-sm font-semibold underline underline-offset-4"
                      >
                        {c.where === 'design' ? 'Open the Design tab' : 'Show me'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {report.keywords && (
            <div
              className="border-line flex flex-col gap-3 border-t pt-4"
              data-testid="ats-keywords"
            >
              <h3 className="font-semibold">Keywords for {report.keywords.jobTitle}</h3>
              {report.keywords.present.length > 0 && (
                <div>
                  <p className="text-ink-muted mb-1.5 text-sm">
                    In your CV ({report.keywords.present.length})
                  </p>
                  <ul className="flex flex-wrap gap-1.5" aria-label="Keywords in your CV">
                    {report.keywords.present.map((t) => (
                      <li
                        key={t}
                        className="bg-success-soft text-success rounded-full px-2.5 py-1 text-sm font-semibold"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.keywords.missing.length > 0 && (
                <div>
                  <p className="text-ink-muted mb-1.5 text-sm">
                    Not in your CV ({report.keywords.missing.length}). Add a word only where it’s
                    true for you.
                  </p>
                  <ul className="flex flex-col gap-2" aria-label="Keywords not in your CV">
                    {report.keywords.missing.map((m) => (
                      <li key={m.term} className="text-sm">
                        <span className="bg-sunken rounded-full px-2.5 py-1 font-semibold">
                          {m.term}
                        </span>
                        {m.line && (
                          <span className="text-ink-muted mt-1 block">
                            You may already show this: “{m.line.text}”{' '}
                            <button
                              type="button"
                              onClick={() => onShow(m.line!.ref)}
                              className="text-primary font-semibold underline underline-offset-4"
                            >
                              Show me
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <details className="text-sm">
            <summary className="text-primary cursor-pointer font-semibold">
              What the software reads first
            </summary>
            <pre className="bg-sunken mt-2 overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
              {report.sample.join('\n')}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
