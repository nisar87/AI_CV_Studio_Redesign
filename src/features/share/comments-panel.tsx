'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, MessageSquare, RotateCcw, Trash2 } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { useAccount } from '@/features/account/account-context';
import type { OwnerComment } from '@/modules/share/comments';

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Comments reviewers left through this CV's share link (spec §9.1), in the editor's Check tab.
 * Each one says where it is, with "Show me"; it can be marked done or deleted. Hidden until there
 * is a comment (the share panel is where comments are turned on).
 */
export function CommentsPanel({ docId, onShow }: { docId: string; onShow: (ref: string) => void }) {
  const account = useAccount();
  const signedIn = account.status === 'signedIn';
  const [comments, setComments] = useState<OwnerComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const base = `/api/documents/${encodeURIComponent(docId)}/comments`;

  const load = useCallback(() => {
    if (!signedIn) return;
    fetch(base, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((j: { comments?: OwnerComment[] }) => setComments(j.comments ?? []))
      .catch(() => setComments([]));
  }, [base, signedIn]);
  useEffect(load, [load]);

  // Links from the comment email and the share panel end in #comments.
  useEffect(() => {
    if (comments?.length && window.location.hash === '#comments')
      section.current?.scrollIntoView({ block: 'start' });
  }, [comments]);

  if (!comments?.length) return null;

  const update = async (c: OwnerComment, status: 'open' | 'done') => {
    const before = comments;
    setComments((l) => l && l.map((x) => (x.id === c.id ? { ...x, status } : x)));
    const r = await fetch(`${base}/${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!r?.ok) {
      setComments(before);
      setError('That didn’t save. Please try again.');
    }
  };
  const remove = async (c: OwnerComment) => {
    if (!confirm(`Delete ${c.author}’s comment?`)) return;
    const before = comments;
    setComments((l) => l && l.filter((x) => x.id !== c.id));
    const r = await fetch(`${base}/${c.id}`, { method: 'DELETE' }).catch(() => null);
    if (!r?.ok) {
      setComments(before);
      setError('That comment couldn’t be deleted. Please try again.');
    }
  };

  const open = comments.filter((c) => c.status === 'open');
  const done = comments.filter((c) => c.status === 'done');
  const item = (c: OwnerComment) => (
    <li
      key={c.id}
      className={`border-line flex flex-col gap-1 border-t pt-3 first:border-t-0 first:pt-0 ${c.status === 'done' ? 'text-ink-muted' : ''}`}
      data-comment={c.id}
    >
      <p className="text-ink-muted text-sm">
        <span className="text-ink font-semibold">{c.author}</span> · {when(c.createdAt)} · {c.where}
      </p>
      {c.quote && <p className="text-ink-muted text-sm italic">“{c.quote}”</p>}
      <p className="whitespace-pre-wrap">{c.text}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {c.ref && (
          <button
            type="button"
            onClick={() => onShow(c.ref)}
            className="text-primary font-semibold underline underline-offset-4"
          >
            Show me
          </button>
        )}
        <button
          type="button"
          onClick={() => void update(c, c.status === 'open' ? 'done' : 'open')}
          className="text-primary inline-flex items-center gap-1 font-semibold underline underline-offset-4"
        >
          {c.status === 'open' ? (
            <>
              <Check aria-hidden size={14} /> Mark as done
            </>
          ) : (
            <>
              <RotateCcw aria-hidden size={14} /> Not done
            </>
          )}
          <span className="sr-only"> — comment from {c.author}</span>
        </button>
        <button
          type="button"
          onClick={() => void remove(c)}
          className="text-ink-muted hover:text-danger inline-flex items-center gap-1 underline underline-offset-4"
        >
          <Trash2 aria-hidden size={14} /> Delete
          <span className="sr-only"> the comment from {c.author}</span>
        </button>
      </div>
    </li>
  );

  return (
    <section
      ref={section}
      id="comments"
      aria-labelledby="comments-h"
      className="border-line bg-surface shadow-1 flex scroll-mt-4 flex-col gap-4 rounded-lg border p-5"
      data-testid="comments"
    >
      <div>
        <h2 id="comments-h" className="flex items-center gap-2 font-semibold">
          <MessageSquare aria-hidden size={18} className="text-primary" /> Comments from reviewers
        </h2>
        <p className="text-ink-muted text-sm">
          {open.length
            ? `${open.length} to look at. People you shared a link with left these notes.`
            : 'All done. People you shared a link with left these notes.'}
        </p>
      </div>
      {error && (
        <Banner tone="error" title={error} onDismiss={() => setError(null)}>
          {null}
        </Banner>
      )}
      {open.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Comments to look at">
          {open.map(item)}
        </ul>
      )}
      {done.length > 0 && (
        <details className="text-sm" open={!open.length}>
          <summary className="text-primary cursor-pointer font-semibold">
            Done ({done.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-3 text-base" aria-label="Done comments">
            {done.map(item)}
          </ul>
        </details>
      )}
    </section>
  );
}
