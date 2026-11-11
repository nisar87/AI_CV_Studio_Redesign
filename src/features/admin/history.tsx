'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { AdminHeading } from './admin-shell';
import { adminGet, adminSend } from './api';
import { when } from './overview';

type Versions = {
  version: number;
  versions: { version: number; savedAt: string; savedBy: string }[];
};
type Audit = {
  entries: {
    id: string;
    at: string;
    by: string;
    action: string;
    target: string;
    detail?: unknown;
  }[];
};

const ACTION_LABEL: Record<string, string> = {
  'config.save': 'Saved settings',
  'config.restore': 'Restored settings',
  'pass.grant': 'Granted Premium',
  'pass.revoke': 'Removed Premium',
  'usage.reset': 'Reset usage',
  'user.disable': 'Blocked sign-in',
  'user.enable': 'Allowed sign-in',
};

export function AdminHistory() {
  const toast = useToast();
  const [versions, setVersions] = useState<Versions | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminGet<Versions>('/api/admin/config').then(setVersions, (e: Error) => setError(e.message));
    adminGet<Audit>('/api/admin/audit').then(setAudit, (e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const restore = async (version: number) => {
    if (!confirm(`Make version ${version} the current settings again?`)) return;
    setBusy(true);
    try {
      const r = await adminSend<{ version: number }>('/api/admin/config/restore', 'POST', {
        version,
      });
      toast.show({
        tone: 'success',
        message: `Version ${version} restored as version ${r.version}.`,
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminHeading
        title="History & audit"
        intro="Every settings version, and every change made by an administrator."
      />
      {error && (
        <Banner tone="error" title="Something didn't load" className="mb-4">
          {error}
        </Banner>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="border-line bg-surface rounded-lg border p-5">
          <h2 className="mb-3 text-lg font-semibold">Settings versions</h2>
          {!versions ? (
            <div className="skeleton h-24 rounded-md" aria-busy="true" />
          ) : versions.versions.length === 0 ? (
            <p className="text-ink-muted text-sm">
              Nothing saved yet — the studio is using its starting settings.
            </p>
          ) : (
            <ul className="divide-line divide-y text-sm" data-testid="config-versions">
              {versions.versions.map((v) => (
                <li key={v.version} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <strong>v{v.version}</strong> · {when(v.savedAt)}
                    <span className="text-ink-muted block">{v.savedBy}</span>
                  </span>
                  {v.version === versions.version ? (
                    <span className="text-ink-muted">Current</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => restore(v.version)}
                    >
                      Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="border-line bg-surface rounded-lg border p-5">
          <h2 className="mb-3 text-lg font-semibold">Audit log</h2>
          {!audit ? (
            <div className="skeleton h-24 rounded-md" aria-busy="true" />
          ) : audit.entries.length === 0 ? (
            <p className="text-ink-muted text-sm">No admin changes yet.</p>
          ) : (
            <ul className="divide-line divide-y text-sm" data-testid="audit-log">
              {audit.entries.map((e) => (
                <li key={e.id} className="py-2">
                  <p>
                    <strong>{ACTION_LABEL[e.action] ?? e.action}</strong> · {e.target}
                  </p>
                  <p className="text-ink-muted">
                    {when(e.at)} · {e.by}
                  </p>
                  {Array.isArray(e.detail) && e.detail.length > 0 && (
                    <ul className="text-ink-muted mt-1 list-disc pl-5 font-mono text-xs">
                      {(e.detail as string[]).slice(0, 8).map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
