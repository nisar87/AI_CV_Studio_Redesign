'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { MessageSquare, Trash2, X } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextArea, TextField } from '@/components/ui/field';
import type { ResumeDocument } from '@/modules/resume/schema';
import {
  commentTargets,
  MAX_AUTHOR,
  MAX_TEXT,
  type ReviewerComment,
} from '@/modules/share/comments';

const KEY = 'cvstudio:reviewer-key';
const NAME = 'cvstudio:reviewer-name';

/** A random key kept in this browser, so a reviewer can see and delete their own comments. */
function reviewerKey(): string {
  const make = () => {
    const b = new Uint8Array(24);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode(...b))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  try {
    const k = localStorage.getItem(KEY);
    if (k && /^[A-Za-z0-9_-]{22,64}$/.test(k)) return k;
    const n = make();
    localStorage.setItem(KEY, n);
    return n;
  } catch {
    return make(); // private mode: comments still work, but only for this visit
  }
}
const readName = () => {
  try {
    return localStorage.getItem(NAME) ?? '';
  } catch {
    return '';
  }
};

export type ReviewPanelHandle = { pick: (ref: string, text: string) => void };

/**
 * Comments for reviewers (spec §9.1) on a shared CV: pick a line (click it on the page, or choose
 * from the list), write a note, and it goes to the CV's owner. Reviewers see only their own notes.
 */
export const ReviewPanel = forwardRef<
  ReviewPanelHandle,
  { token: string; doc: ResumeDocument; ownerName: string }
>(function ReviewPanel({ token, doc, ownerName }, ref) {
  const targets = useMemo(() => commentTargets(doc), [doc]);
  const [key, setKey] = useState('');
  const [target, setTarget] = useState('');
  const [quote, setQuote] = useState('');
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<ReviewerComment[]>([]);
  const form = useRef<HTMLElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const base = `/api/s/${encodeURIComponent(token)}/comments`;

  useEffect(() => {
    const k = reviewerKey();
    setKey(k);
    setAuthor(readName());
    fetch(base, { cache: 'no-store', headers: { 'x-reviewer-key': k } })
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((j: { comments?: ReviewerComment[] }) => setMine(j.comments ?? []))
      .catch(() => {});
  }, [base]);

  useImperativeHandle(ref, () => ({
    pick(r: string, t: string) {
      const known = targets.some((x) => x.ref === r);
      // A click on the contact line or the name belongs to "Name and contact details".
      setTarget(known ? r : r.startsWith('basics') ? 'basics' : '');
      setQuote(t.replace(/\s+/g, ' ').trim().slice(0, 300));
      setSent(false);
      form.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      box.current?.focus({ preventScroll: true });
    },
  }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref: target, quote, text, author, key, website }),
      });
      const j = (await r.json().catch(() => null)) as {
        comment?: ReviewerComment | null;
        error?: { message: string };
      } | null;
      if (!r.ok) {
        setError(j?.error?.message ?? 'Your comment wasn’t sent. Please try again.');
        return;
      }
      try {
        localStorage.setItem(NAME, author.trim());
      } catch {}
      if (j?.comment) setMine((m) => [j.comment!, ...m]);
      setText('');
      setQuote('');
      setSent(true);
    } catch {
      setError('You seem to be offline. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: ReviewerComment) => {
    const before = mine;
    setMine((m) => m.filter((x) => x.id !== c.id));
    const r = await fetch(`${base}/${c.id}`, {
      method: 'DELETE',
      headers: { 'x-reviewer-key': key },
    }).catch(() => null);
    if (!r?.ok) {
      setMine(before);
      setError('That comment couldn’t be deleted. Please try again.');
    }
  };

  const first = ownerName.split(/\s+/)[0] || 'The owner';
  return (
    <aside
      ref={form}
      aria-labelledby="review-h"
      className="border-line bg-surface shadow-1 flex flex-col gap-4 rounded-lg border p-5"
      data-testid="review-panel"
    >
      <div>
        <h2 id="review-h" className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare aria-hidden size={18} className="text-primary" /> Leave a comment
        </h2>
        <p className="text-ink-muted text-sm">
          Click a line on the CV, or choose a part below. Your comment goes only to {first}; others
          with this link don’t see it.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Which part?
          <select
            className="border-line-strong bg-surface min-h-11 w-full min-w-0 rounded-md border px-3 text-[15px] font-normal"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setQuote('');
            }}
          >
            {targets.map((t) => (
              <option key={t.ref || 'all'} value={t.ref}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {quote && (
          <div className="bg-sunken flex items-start gap-2 rounded-md p-3 text-sm">
            <p className="min-w-0 flex-1 break-words" data-testid="review-quote">
              <span className="sr-only">About the words: </span>“{quote}”
            </p>
            <button
              type="button"
              onClick={() => setQuote('')}
              aria-label="Don’t quote these words"
              className="text-ink-muted hover:text-ink -m-1 rounded p-1"
            >
              <X aria-hidden size={16} />
            </button>
          </div>
        )}
        <TextArea
          ref={box}
          label="Your comment"
          value={text}
          maxLength={MAX_TEXT}
          rows={4}
          onChange={(e) => setText(e.target.value)}
          hint="For example: “Start this point with the result.”"
        />
        <TextField
          label="Your name"
          value={author}
          maxLength={MAX_AUTHOR}
          autoComplete="name"
          onChange={(e) => setAuthor(e.target.value)}
          hint={`So ${first} knows who it’s from.`}
        />
        {/* For robots only: hidden from people and screen readers. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <Banner tone="error" title="Not sent" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
        <p aria-live="polite" className="text-success text-sm font-semibold empty:hidden">
          {sent ? `Sent. ${first} will see it in their studio.` : ''}
        </p>
        <Button
          type="submit"
          loading={busy}
          disabled={busy || !text.trim() || !author.trim() || !key}
          className="self-start"
        >
          Send comment
        </Button>
      </form>

      {mine.length > 0 && (
        <section aria-labelledby="mine-h" className="border-line border-t pt-4">
          <h3 id="mine-h" className="mb-2 font-semibold">
            Your comments ({mine.length})
          </h3>
          <ul className="flex flex-col gap-3" data-testid="my-comments">
            {mine.map((c) => (
              <li key={c.id} className="text-sm">
                <p className="text-ink-muted">
                  {c.where}
                  {c.done && ' · marked done'}
                </p>
                {c.quote && <p className="text-ink-muted italic">“{c.quote}”</p>}
                <p className="whitespace-pre-wrap">{c.text}</p>
                <button
                  type="button"
                  onClick={() => void remove(c)}
                  className="text-ink-muted hover:text-danger mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-4"
                >
                  <Trash2 aria-hidden size={14} /> Delete
                  <span className="sr-only"> this comment</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
});
