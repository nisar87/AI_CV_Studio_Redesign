'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { ButtonLink } from '@/components/ui/button';
import { AdminHeading } from './admin-shell';
import { adminGet } from './api';

type Overview = {
  month: string;
  users: {
    total: number;
    recent: { uid: string; email: string | null; lastSeenAt: string | null }[];
  };
  usage: Record<'pdf.download' | 'import.cv' | 'ai.action', number>;
  premium: { active: number; total: number };
  payments: { pending: number };
  numbers: {
    from: string;
    newAccounts: number;
    visitorsAtDownload: number;
    pdfs: number;
    hitDownloadLimit: number;
    imports: number;
    importsWithAi: number;
    importFailures: number;
    aiActions: number;
    aiFailures: number;
    aiCallsToday: number;
    aiDailyBudget: number;
    premiumRequests: number;
    premiumApproved: number;
    premiumRejected: number;
    avgApprovalMinutes: number | null;
    daily: { day: string; accounts: number; pdfs: number; imports: number; ai: number }[];
  };
  config: { version: number; sales: boolean; ai: boolean; maintenance: boolean };
  aiProvider: string;
};

export function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminGet<Overview>('/api/admin/overview').then(setData, (e: Error) => setError(e.message));
  }, []);
  return (
    <>
      <AdminHeading title="Overview" intro="How the studio is doing this month." />
      {error && (
        <Banner tone="error" title="Could not load the overview">
          {error}
        </Banner>
      )}
      {!data && !error && <div className="skeleton h-40 rounded-lg" aria-busy="true" />}
      {data && (
        <div className="flex flex-col gap-6">
          {data.payments.pending > 0 && (
            <Banner
              tone="warning"
              title={`${data.payments.pending} payment${data.payments.pending === 1 ? '' : 's'} waiting for a check`}
              action={
                <ButtonLink href="/admin/payments" size="sm">
                  Review payments
                </ButtonLink>
              }
            />
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="admin-stats">
            <Stat label="Accounts" value={data.users.total} />
            <Stat label="Premium active" value={data.premium.active} />
            <Stat label={`PDF downloads (${data.month})`} value={data.usage['pdf.download']} />
            <Stat label={`AI actions (${data.month})`} value={data.usage['ai.action']} />
          </div>
          <Numbers n={data.numbers} />
          <section className="border-line bg-surface rounded-lg border p-5">
            <h2 className="mb-3 text-lg font-semibold">Switches</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              <Flag on={data.config.sales} label="Premium sales" />
              <Flag on={data.config.ai} label="AI help (setting)" />
              <Flag on={data.aiProvider !== 'off'} label={`AI server: ${data.aiProvider}`} />
              <Flag
                on={!data.config.maintenance}
                label={data.config.maintenance ? 'Maintenance mode' : 'Open'}
              />
            </ul>
            <p className="text-ink-muted mt-3 text-sm">Settings version {data.config.version}.</p>
          </section>
          <section className="border-line bg-surface rounded-lg border p-5">
            <h2 className="mb-3 text-lg font-semibold">Recently active</h2>
            {data.users.recent.length === 0 ? (
              <p className="text-ink-muted text-sm">No accounts yet.</p>
            ) : (
              <ul className="divide-line divide-y text-sm">
                {data.users.recent.map((u) => (
                  <li key={u.uid} className="flex justify-between gap-4 py-2">
                    <span className="truncate">{u.email ?? u.uid}</span>
                    <span className="text-ink-muted shrink-0">{when(u.lastSeenAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-line bg-surface rounded-lg border p-4">
      <p className="text-ink-muted text-sm">{label}</p>
      <p className="font-display mt-1 text-3xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <li
      className={
        on
          ? 'rounded-full bg-[#e3f1e6] px-3 py-1 font-semibold text-[#1f5c2e]'
          : 'bg-sunken text-ink-muted rounded-full px-3 py-1 font-semibold'
      }
    >
      {on ? '● ' : '○ '}
      {label}
    </li>
  );
}

export function when(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function Numbers({ n }: { n: Overview['numbers'] }) {
  const budgetUse = n.aiDailyBudget ? n.aiCallsToday / n.aiDailyBudget : 0;
  const rows: [string, string, string?][] = [
    ['New accounts', String(n.newAccounts)],
    [
      'Visitors asked to sign in at download',
      String(n.visitorsAtDownload),
      n.visitorsAtDownload
        ? `${pct(n.newAccounts, n.visitorsAtDownload + n.newAccounts)} became accounts (approx.)`
        : undefined,
    ],
    [
      'PDF downloads',
      String(n.pdfs),
      n.hitDownloadLimit ? `${n.hitDownloadLimit} stopped by the monthly limit` : undefined,
    ],
    [
      'CV imports',
      String(n.imports),
      `${pct(n.imports, n.imports + n.importFailures)} succeeded · ${pct(n.importsWithAi, n.imports)} sorted by AI`,
    ],
    ['AI actions', String(n.aiActions), n.aiFailures ? `${n.aiFailures} failed` : undefined],
    [
      'Premium',
      `${n.premiumApproved} approved`,
      `${n.premiumRequests} requests · ${n.premiumRejected} rejected${n.avgApprovalMinutes !== null ? ` · approved in ${fmtMinutes(n.avgApprovalMinutes)} on average` : ''}`,
    ],
  ];
  return (
    <section className="border-line bg-surface rounded-lg border p-5" data-testid="admin-numbers">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Last 30 days</h2>
        <span className="text-ink-muted text-sm">Counts only — no CV content is recorded.</span>
      </div>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value, note]) => (
          <div key={label}>
            <dt className="text-ink-muted text-sm">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {value}
              {note && <span className="text-ink-muted ml-2 text-sm font-normal">{note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5">
        <p className="text-sm">
          AI calls today: <strong className="tabular-nums">{n.aiCallsToday}</strong> of{' '}
          {n.aiDailyBudget.toLocaleString()} daily budget
        </p>
        <div
          className="bg-sunken mt-1.5 h-2 overflow-hidden rounded-full"
          role="meter"
          aria-label="AI daily budget used"
          aria-valuemin={0}
          aria-valuemax={n.aiDailyBudget}
          aria-valuenow={n.aiCallsToday}
        >
          <div
            className={budgetUse >= 0.8 ? 'bg-danger h-full' : 'bg-primary h-full'}
            style={{ width: `${Math.min(100, budgetUse * 100)}%` }}
          />
        </div>
        {budgetUse >= 0.8 && (
          <p className="text-danger mt-1 text-sm font-semibold">
            Over 80% of today’s AI budget is used.
          </p>
        )}
      </div>
    </section>
  );
}

function fmtMinutes(m: number) {
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} days`;
}
