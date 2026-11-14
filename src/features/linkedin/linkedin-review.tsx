'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, CirclePlus, FileUp, Sparkles } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { useAccount } from '@/features/account/account-context';
import { useEntitlements } from '@/features/account/entitlements';
import { cn } from '@/lib/cn';
import {
  LINKEDIN_LIMITS,
  visibleMarkers,
  type LinkedinReview as Review,
  type ReviewSection,
} from '@/modules/linkedin/review';
import { getRepository } from '@/modules/storage/repository';
import { CopyField } from './copy-field';

type Saved = Review & { compared: boolean; createdAt: string; file: string };
const KEY = 'cvstudio:v1:linkedin-review';

const STATUS: Record<
  ReviewSection['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  good: { label: 'Good', icon: CheckCircle2, className: 'bg-success-soft text-success' },
  improve: {
    label: 'Could be better',
    icon: CircleAlert,
    className: 'bg-warning-soft text-warning',
  },
  missing: { label: 'Missing', icon: CirclePlus, className: 'bg-info-soft text-info' },
};

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function keep(r: Saved | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage full or blocked: the review still shows */
  }
}

/**
 * LinkedIn review (R9.9): upload LinkedIn's "Save to PDF" export and get each section reviewed,
 * with text to paste back. Premium, one AI action. The file is read on the server and not kept;
 * the review is kept in this browser.
 */
export function LinkedinReview() {
  const account = useAccount();
  const { ent, refresh } = useEntitlements();
  const repo = typeof window === 'undefined' ? null : getRepository();
  const cvs = useMemo(() => repo?.list() ?? [], [repo]);
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState(cvs.find((c) => c.role === 'profile')?.id ?? cvs[0]?.id ?? '');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; premium?: boolean } | null>(null);
  const [review, setReview] = useState<Saved | null>(load);
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const fresh = useRef(false);
  // A new review appears below the form: bring it into view (on phones it starts off screen).
  useEffect(() => {
    if (!fresh.current || !review) return;
    fresh.current = false;
    heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    heading.current?.focus({ preventScroll: true });
  }, [review]);

  const signedOut = account.status === 'signedOut';
  const locked = ent ? ent.limits['ai.action'] === 0 : false;
  const off = ent ? !ent.features.linkedinReview : false;

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set('file', file);
    const doc = docId ? repo?.get(docId) : null;
    if (doc) form.set('document', JSON.stringify(doc));
    if (target.trim()) form.set('target', target.trim());
    try {
      const r = await fetch('/api/linkedin/review', { method: 'POST', body: form });
      const j = (await r.json().catch(() => null)) as {
        review?: Review & { compared: boolean; createdAt: string };
        error?: { code: string; message: string };
      } | null;
      if (!r.ok || !j?.review) {
        const code = j?.error?.code ?? '';
        setError({
          message: j?.error?.message ?? 'The review couldn’t be made. Please try again.',
          premium: code === 'PREMIUM_REQUIRED' || code === 'LIMIT_REACHED',
        });
        return;
      }
      const next: Saved = {
        ...j.review,
        sections: j.review.sections.map((s) => ({ ...s, rewrite: visibleMarkers(s.rewrite) })),
        file: file.name,
      };
      fresh.current = true;
      setReview(next);
      keep(next);
    } catch {
      setError({ message: 'You seem to be offline. Please try again.' });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const edit = (i: number, rewrite: string) =>
    setReview((r) => {
      if (!r) return r;
      const next = { ...r, sections: r.sections.map((s, j) => (j === i ? { ...s, rewrite } : s)) };
      keep(next);
      return next;
    });

  if (signedOut)
    return (
      <Banner
        tone="info"
        title="Sign in to review your LinkedIn profile"
        action={<ButtonLink href="/signin?next=/linkedin?tab=review">Sign in</ButtonLink>}
      />
    );
  if (off) return <Banner tone="info" title="The LinkedIn review is switched off right now." />;
  if (locked)
    return (
      <Banner
        tone="info"
        title="The LinkedIn review is part of Premium"
        action={<ButtonLink href="/premium?next=/linkedin?tab=review">See Premium</ButtonLink>}
      >
        Upload your LinkedIn profile and get a review of each section, with better text to paste
        back.
      </Banner>
    );

  const asks = review
    ? (review.sections
        .map((s) => s.rewrite)
        .join(' ')
        .match(/\[[^\]]+\]/g)?.length ?? 0)
    : 0;

  return (
    <>
      <Card className="flex flex-col gap-5 p-5" data-testid="linkedin-review-form">
        <ol className="text-ink-muted flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>On LinkedIn, open your own profile.</li>
          <li>
            Press <strong className="text-ink">More</strong> (or{' '}
            <strong className="text-ink">Resources</strong>), then{' '}
            <strong className="text-ink">Save to PDF</strong>.
          </li>
          <li>Upload that file here. We read it and don’t keep it.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            icon={<FileUp aria-hidden size={18} />}
            onClick={() => input.current?.click()}
          >
            {file ? 'Choose another file' : 'Choose the PDF'}
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="LinkedIn profile PDF"
            tabIndex={-1}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
          <span className="text-sm" data-testid="linkedin-file">
            {file ? file.name : 'No file chosen'}
          </span>
        </div>
        {cvs.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Compare with my CV
            <select
              className="border-line-strong bg-surface min-h-11 rounded-md border px-3 text-[15px] font-normal"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
            >
              <option value="">Don’t compare</option>
              {cvs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.role === 'profile' ? 'Career profile' : c.title || c.name || 'Untitled CV'}
                </option>
              ))}
            </select>
            <span className="text-ink-muted text-xs font-normal">
              The review points out what your CV shows that LinkedIn doesn’t, and uses it in the
              suggested text.
            </span>
          </label>
        )}
        <TextField
          label="The kind of role you want next"
          optional
          hint="For example “transport planning”. Leave empty to review for your current work."
          value={target}
          maxLength={160}
          onChange={(e) => setTarget(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            icon={<Sparkles aria-hidden size={18} />}
            loading={busy}
            loadingText="Reviewing… this takes about 30 seconds"
            disabled={!file}
            onClick={run}
          >
            Review my profile
          </Button>
          <span className="text-ink-muted text-xs">Uses 1 AI action.</span>
        </div>
        {error && (
          <Banner
            tone="error"
            title="That didn’t work"
            onDismiss={() => setError(null)}
            action={
              error.premium ? (
                <ButtonLink size="sm" href="/premium?next=/linkedin?tab=review">
                  See Premium
                </ButtonLink>
              ) : undefined
            }
          >
            {error.message}
          </Banner>
        )}
      </Card>

      {review && (
        <section
          aria-labelledby="review-h"
          className="flex flex-col gap-4"
          data-testid="linkedin-review"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="review-h"
              ref={heading}
              tabIndex={-1}
              className="font-display scroll-mt-20 text-2xl font-semibold outline-none"
            >
              Your review
            </h2>
            <p className="text-ink-muted text-sm">
              {review.file} ·{' '}
              {new Date(review.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
              {review.compared ? ' · compared with your CV' : ''}
            </p>
          </div>
          {review.overall && <p className="text-[17px] leading-relaxed">{review.overall}</p>}
          {asks > 0 && (
            <Banner tone="warning" title={`${asks} detail${asks > 1 ? 's' : ''} to check`}>
              Replace or remove the parts in [brackets] before you paste. They mark facts that
              aren’t in your profile or CV.
            </Banner>
          )}
          <ul className="flex flex-col gap-4" aria-label="Sections">
            {review.sections.map((s, i) => {
              const st = STATUS[s.status];
              const Icon = st.icon;
              return (
                <li key={`${s.key}-${i}`}>
                  <Card className="flex flex-col gap-3 p-5" data-section={s.key}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">{s.title}</h3>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          st.className,
                        )}
                      >
                        <Icon aria-hidden size={14} /> {st.label}
                      </span>
                    </div>
                    {s.current && (
                      <div className="bg-sunken rounded-md p-3 text-sm">
                        <p className="text-ink-muted mb-1 text-xs font-semibold uppercase">Now</p>
                        <p className="whitespace-pre-line">{s.current}</p>
                      </div>
                    )}
                    {s.notes.length > 0 && (
                      <ul className="flex list-disc flex-col gap-1 pl-5">
                        {s.notes.map((n, k) => (
                          <li key={k}>{n}</li>
                        ))}
                      </ul>
                    )}
                    {s.rewrite && (
                      <CopyField
                        label={`Suggested text — ${s.title}`}
                        value={s.rewrite}
                        limit={LINKEDIN_LIMITS[s.key]}
                        rows={s.key === 'about' ? 10 : s.key === 'headline' ? 2 : 4}
                        onChange={(v) => edit(i, v)}
                        bare
                      />
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => {
              setReview(null);
              keep(null);
              setFile(null);
            }}
          >
            Clear this review
          </Button>
        </section>
      )}
    </>
  );
}
