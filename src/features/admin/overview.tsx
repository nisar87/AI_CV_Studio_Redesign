'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="admin-stats">
            <Stat label="Accounts" value={data.users.total} />
            <Stat label="Premium active" value={data.premium.active} />
            <Stat label={`PDF downloads (${data.month})`} value={data.usage['pdf.download']} />
            <Stat label={`AI actions (${data.month})`} value={data.usage['ai.action']} />
          </div>
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
