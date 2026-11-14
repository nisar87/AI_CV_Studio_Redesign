'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2 } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useEntitlements } from '@/features/account/entitlements';
import { CheckboxField } from '@/features/editor/fields';
import type { ShareView } from '@/modules/share/server';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const j = (await r.json().catch(() => null)) as (T & { error?: { message: string } }) | null;
  if (!r.ok || !j || j.error)
    throw new Error(j?.error?.message ?? 'That didn’t work. Please try again.');
  return j;
}

/** Create, copy and switch off a read-only link to this CV (always shows its latest version). */
export function SharePanel({ docId }: { docId: string }) {
  const toast = useToast();
  const { ent } = useEntitlements();
  const commentsOn = ent ? ent.features.shareComments : false;
  const [share, setShare] = useState<ShareView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    call<{ shares: ShareView[] }>(`/api/shares?docId=${encodeURIComponent(docId)}`).then(
      (r) => setShare(r.shares[0] ?? null),
      () => setShare(null),
    );
  }, [docId]);
  useEffect(load, [load]);

  const url = share ? `${window.location.origin}/s/${share.token}` : '';
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const create = () =>
    act(async () => {
      const r = await call<{ share: ShareView }>('/api/shares', {
        method: 'POST',
        body: JSON.stringify({ docId }),
      });
      setShare(r.share);
    });
  /** Changes one setting at once and undoes it if the server refuses. */
  const change = (
    patch: Partial<Pick<ShareView, 'enabled' | 'comments' | 'notify'>>,
    done: string,
  ) => {
    const before = share!;
    setShare({ ...before, ...patch });
    return act(async () => {
      try {
        const r = await call<{ share: ShareView }>(`/api/shares/${before.token}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        setShare((cur) => ({ ...r.share, openComments: cur?.openComments ?? 0 }));
        toast.show({ tone: 'success', message: done });
      } catch (e) {
        setShare(before);
        throw e;
      }
    });
  };
  const toggle = (enabled: boolean) =>
    change({ enabled }, enabled ? 'Link switched on' : 'Link switched off');
  const remove = () =>
    act(async () => {
      if (!confirm('Delete this link? Anyone who has it will no longer see your CV.')) return;
      await call(`/api/shares/${share!.token}`, { method: 'DELETE' });
      setShare(null);
    });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ tone: 'success', message: 'Link copied' });
    } catch {
      toast.show({ tone: 'error', message: 'Couldn’t copy. Select the link and copy it.' });
    }
  };

  if (share === undefined) return null;
  return (
    <Card className="flex flex-col gap-3 p-5" data-testid="share-panel">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Link2 aria-hidden size={18} /> Share a link
      </h2>
      <p className="text-ink-muted -mt-1 text-sm">
        A private, read-only link that always shows your latest version. Only people you give it to
        can open it, and you can switch it off at any time.
      </p>
      {error && (
        <Banner tone="error" title="That didn’t work" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {!share ? (
        <Button variant="secondary" loading={busy} onClick={create} className="self-start">
          Create a link
        </Button>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="Link to your CV"
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className={`border-line-strong bg-surface min-h-11 min-w-0 flex-1 rounded-md border px-3 text-sm ${share.enabled ? '' : 'text-ink-muted line-through'}`}
            />
            <Button
              variant="secondary"
              icon={<Copy aria-hidden size={16} />}
              onClick={copy}
              disabled={!share.enabled}
            >
              Copy
            </Button>
          </div>
          <CheckboxField
            label="Link is on"
            checked={share.enabled}
            onChange={(v) => void toggle(v)}
          />
          {(commentsOn || share.comments) && (
            <div
              className="border-line flex flex-col gap-1 border-t pt-3"
              data-testid="share-comments"
            >
              <CheckboxField
                label="Let people with the link leave comments"
                checked={share.comments}
                onChange={(v) =>
                  void change(
                    { comments: v },
                    v ? 'Comments are on for this link' : 'Comments are off for this link',
                  )
                }
              />
              <p className="text-ink-muted -mt-1 pl-8 text-sm">
                A friend or mentor clicks a line and leaves a note. Only you see all the comments.
              </p>
              {share.comments && (
                <CheckboxField
                  label="Email me when someone comments (at most once an hour)"
                  checked={share.notify}
                  onChange={(v) =>
                    void change({ notify: v }, v ? 'Comment emails on' : 'Comment emails off')
                  }
                />
              )}
              {(share.openComments ?? 0) > 0 && (
                <Link
                  href={`/cv/${docId}?tab=check#comments`}
                  className="text-primary pl-8 text-sm font-semibold underline underline-offset-4"
                  data-testid="share-open-comments"
                >
                  {share.openComments === 1
                    ? 'Read the 1 comment waiting'
                    : `Read the ${share.openComments} comments waiting`}
                </Link>
              )}
            </div>
          )}
          <p className="text-ink-muted text-sm" data-testid="share-views">
            {share.views === 1 ? 'Opened once' : `Opened ${share.views} times`}
            {share.lastViewedAt &&
              `, last on ${new Date(share.lastViewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
            .
          </p>
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="self-start">
            Delete this link
          </Button>
        </>
      )}
    </Card>
  );
}
