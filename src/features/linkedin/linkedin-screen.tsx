'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextArea, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useAccount } from '@/features/account/account-context';
import { useEntitlements } from '@/features/account/entitlements';
import { callAi } from '@/features/ai/client';
import { profileDigest } from '@/modules/jobs/digest';
import { getRepository } from '@/modules/storage/repository';

type Result = {
  headline: string;
  about: string;
  experience: { job: string; title: string; text: string }[];
  skills: string[];
};
/** `{{?confirm: X}}` → `[confirm: X]` so the person can see and replace it in a plain text box. */
const visible = (s: string) => s.replace(/\{\{\?([^{}]*)\}\}/g, '[$1]');
const LIMITS = { headline: 220, about: 2600, experience: 2000 };
const cacheKey = (id: string) => `cvstudio:v1:linkedin:${id}`;

/** LinkedIn profile writer (Premium): headline, About and job descriptions, ready to paste. */
export function LinkedinScreen() {
  // CVs live in this browser: render after mounting so server and client agree.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted)
    return <div className="skeleton mx-auto my-8 h-80 max-w-[860px] rounded-lg" aria-busy="true" />;
  return <LinkedinWriter />;
}

function LinkedinWriter() {
  const account = useAccount();
  const { ent, refresh } = useEntitlements();
  const params = useSearchParams();
  const repo = typeof window === 'undefined' ? null : getRepository();
  const cvs = useMemo(() => repo?.list() ?? [], [repo]);
  const [docId, setDocId] = useState(
    params.get('doc') ?? cvs.find((c) => c.role === 'profile')?.id ?? cvs[0]?.id ?? '',
  );
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; premium?: boolean } | null>(null);
  const [result, setResult] = useState<Result | null>(() => {
    try {
      const raw = typeof window === 'undefined' ? null : localStorage.getItem(cacheKey(docId));
      return raw ? (JSON.parse(raw) as Result) : null;
    } catch {
      return null;
    }
  });

  const locked = ent ? ent.limits['ai.action'] === 0 : false;
  const signedOut = account.status === 'signedOut';

  async function write() {
    const doc = repo?.get(docId);
    if (!doc) return;
    setBusy(true);
    setError(null);
    const digest = profileDigest(doc);
    const r = await callAi('linkedin.write', { profile: digest.text.slice(0, 24_000), target });
    setBusy(false);
    refresh();
    if (!r.ok) {
      if (r.code !== 'ABORTED')
        setError({
          message: r.message,
          premium: r.code === 'PREMIUM_REQUIRED' || r.code === 'LIMIT_REACHED',
        });
      return;
    }
    const o = r.data.result;
    const next: Result = {
      headline: visible(o.headline),
      about: visible(o.about),
      experience: o.experience.map((e) => ({
        job: e.job,
        title: digest.lines.get(e.job)?.text ?? e.job,
        text: visible(e.text),
      })),
      skills: o.skills,
    };
    setResult(next);
    try {
      localStorage.setItem(cacheKey(docId), JSON.stringify(next));
    } catch {
      /* storage full or blocked: the result still shows */
    }
  }

  const edit = (patch: Partial<Result>) =>
    setResult((r) => {
      const next = r && { ...r, ...patch };
      try {
        if (next) localStorage.setItem(cacheKey(docId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  const asks = result
    ? ([result.headline, result.about, ...result.experience.map((e) => e.text)]
        .join(' ')
        .match(/\[[^\]]+\]/g)?.length ?? 0)
    : 0;

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-8 md:px-8">
      <div>
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight">
          Your LinkedIn profile
        </h1>
        <p className="text-ink-muted mt-1">
          A headline, About section and job descriptions written from your CV, ready to paste into
          LinkedIn. Nothing is invented.
        </p>
      </div>

      {signedOut ? (
        <Banner
          tone="info"
          title="Sign in to write your LinkedIn profile"
          action={<ButtonLink href="/signin?next=/linkedin">Sign in</ButtonLink>}
        />
      ) : locked ? (
        <Banner
          tone="info"
          title="The LinkedIn profile writer is part of Premium"
          action={<ButtonLink href="/premium?next=/linkedin">See Premium</ButtonLink>}
        >
          Get a headline, About section and job descriptions that match your CV, in your own words.
        </Banner>
      ) : cvs.length === 0 ? (
        <p className="text-ink-muted">
          <Link href="/start" className="text-primary font-semibold">
            Create a CV
          </Link>{' '}
          first, then come back here.
        </p>
      ) : (
        <Card className="flex flex-col gap-4 p-5">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Write from
            <select
              className="border-line-strong bg-surface min-h-11 rounded-md border px-3 text-[15px] font-normal"
              value={docId}
              onChange={(e) => {
                setDocId(e.target.value);
                try {
                  const raw = localStorage.getItem(cacheKey(e.target.value));
                  setResult(raw ? (JSON.parse(raw) as Result) : null);
                } catch {
                  setResult(null);
                }
              }}
            >
              {cvs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.role === 'profile' ? 'Career profile' : c.title || c.name || 'Untitled CV'}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="The kind of role you want next"
            optional
            hint="For example “transport planning” or “team leader”. Leave empty to describe your current work."
            value={target}
            maxLength={160}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Button
            icon={<Sparkles aria-hidden size={18} />}
            loading={busy}
            loadingText="Writing… this takes about 20 seconds"
            disabled={!docId}
            onClick={write}
            className="self-start"
          >
            {result ? 'Write again' : 'Write my LinkedIn profile'}
          </Button>
          {error && (
            <Banner
              tone="error"
              title="That didn’t work"
              onDismiss={() => setError(null)}
              action={
                error.premium ? (
                  <ButtonLink size="sm" href="/premium?next=/linkedin">
                    See Premium
                  </ButtonLink>
                ) : undefined
              }
            >
              {error.message}
            </Banner>
          )}
        </Card>
      )}

      {result && !signedOut && !locked && (
        <section
          aria-label="Your LinkedIn text"
          className="flex flex-col gap-4"
          data-testid="linkedin-result"
        >
          {asks > 0 && (
            <Banner tone="warning" title={`${asks} detail${asks > 1 ? 's' : ''} to check`}>
              Replace or remove the parts in [brackets] before you paste. They mark facts that
              aren’t in your CV.
            </Banner>
          )}
          <CopyField
            label="Headline"
            value={result.headline}
            limit={LIMITS.headline}
            rows={2}
            onChange={(v) => edit({ headline: v })}
          />
          <CopyField
            label="About"
            value={result.about}
            limit={LIMITS.about}
            rows={10}
            onChange={(v) => edit({ about: v })}
          />
          {result.experience.map((e, i) => (
            <CopyField
              key={e.job}
              label={e.title}
              value={e.text}
              limit={LIMITS.experience}
              rows={4}
              onChange={(v) =>
                edit({
                  experience: result.experience.map((x, j) => (j === i ? { ...x, text: v } : x)),
                })
              }
            />
          ))}
          {result.skills.length > 0 && (
            <Card className="flex flex-col gap-2 p-5">
              <h2 className="font-semibold">Skills to add</h2>
              <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
                {result.skills.map((s) => (
                  <li key={s} className="bg-sunken rounded-full px-3 py-1 text-sm">
                    {s}
                  </li>
                ))}
              </ul>
              <p className="text-ink-muted text-xs">
                Add these in LinkedIn under Skills, most important first.
              </p>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

function CopyField({
  label,
  value,
  limit,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  limit: number;
  rows: number;
  onChange: (v: string) => void;
}) {
  const toast = useToast();
  const over = value.length > limit;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.show({ tone: 'success', message: `${label} copied` });
    } catch {
      toast.show({ tone: 'error', message: 'Couldn’t copy. Select the text and copy it.' });
    }
  };
  return (
    <Card className="flex flex-col gap-2 p-5">
      <TextArea
        label={label}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${over ? 'text-danger font-semibold' : 'text-ink-muted'}`}>
          {value.length} / {limit} characters{over ? ' — too long for LinkedIn' : ''}
        </span>
        <Button size="sm" variant="secondary" icon={<Copy aria-hidden size={16} />} onClick={copy}>
          Copy
        </Button>
      </div>
    </Card>
  );
}
