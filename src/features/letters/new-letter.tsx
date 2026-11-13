'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Lock, PenLine, Sparkles } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextArea, TextField } from '@/components/ui/field';
import { useAccount } from '@/features/account/account-context';
import { useEntitlements } from '@/features/account/entitlements';
import { JobsError } from '@/features/jobs/api';
import { defaultSourceCv } from '@/modules/jobs/source-cv';
import {
  LETTER_TYPE,
  LETTER_TYPES,
  isLetterType,
  missingAnswers,
  starterLetter,
  type LetterType,
} from '@/modules/letters/types';
import { getRepository } from '@/modules/storage/repository';
import { lettersApi } from './api';

/** /letters/new: pick a letter type, answer its 3–5 questions, then write it with AI or yourself. */
export function NewLetter() {
  const params = useSearchParams();
  const type = params.get('type');
  const account = useAccount();
  const { ent } = useEntitlements();
  if (account.status === 'signedOut')
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <Lock aria-hidden className="text-primary" />
        <h2 className="text-xl font-semibold">Sign in to write and keep letters</h2>
        <p className="text-ink-muted">
          Your letters are kept in your account, in the same design as your CV.
        </p>
        <ButtonLink
          href={`/signin?next=${encodeURIComponent(`/letters/new${type ? `?type=${type}` : ''}`)}`}
        >
          Sign in or create a free account
        </ButtonLink>
      </Card>
    );
  const hidden = new Set(ent?.hiddenLetterTypes ?? []);
  if (ent && !ent.features.letters)
    return <Banner tone="info" title="Letters are switched off right now." />;
  if (isLetterType(type) && !hidden.has(type))
    return <LetterForm key={type} type={LETTER_TYPE[type]} />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Letter types">
      {LETTER_TYPES.filter((t) => !hidden.has(t.id)).map((t) => (
        <li key={t.id}>
          <Link
            href={`/letters/new?type=${t.id}`}
            className="border-line bg-surface hover:border-primary flex h-full flex-col gap-1 rounded-xl border p-5"
          >
            <span className="font-semibold">{t.title}</span>
            <span className="text-ink-muted text-sm">{t.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LetterForm({ type }: { type: LetterType }) {
  const router = useRouter();
  const { ent } = useEntitlements();
  const repo = typeof window === 'undefined' ? null : getRepository();
  const cvs = useMemo(() => repo?.list() ?? [], [repo]);
  const [sourceId, setSourceId] = useState(() => defaultSourceCv(cvs));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [to, setTo] = useState('');
  const [tone, setTone] = useState<'warm' | 'formal'>(type.id === 'cover' ? 'warm' : 'formal');
  const [busy, setBusy] = useState<null | 'ai' | 'self'>(null);
  const [problem, setProblem] = useState<{ message: string; premium?: boolean } | null>(null);
  const [touched, setTouched] = useState(false);
  const aiLocked = ent ? ent.limits['ai.action'] === 0 : false;
  const missing = missingAnswers(type, answers);

  async function create(withAi: boolean, e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (missing.length) return;
    const source = sourceId ? repo?.get(sourceId) : null;
    setBusy(withAi ? 'ai' : 'self');
    setProblem(null);
    try {
      const start = starterLetter(type, answers);
      const letter = await lettersApi.create({
        type: type.id,
        title: start.subject,
        to: to
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 5),
        subject: start.subject,
        answers,
        paragraphs: start.paragraphs,
        greeting: 'Dear Hiring Manager,',
        closing: tone === 'formal' ? 'Yours sincerely,' : 'Kind regards,',
        tone,
        documentId: source?.id ?? '',
      });
      if (withAi && source) {
        try {
          await lettersApi.draft(letter.id, source, tone);
        } catch (err) {
          // The letter is kept with the starter draft; say why the AI draft is missing.
          router.push(`/letters/${letter.id}?ai=${encodeURIComponent((err as Error).message)}`);
          return;
        }
      }
      router.push(`/letters/${letter.id}`);
    } catch (err) {
      setProblem(
        err instanceof JobsError
          ? { message: err.message, premium: err.status === 402 }
          : { message: 'You seem to be offline. Please try again.' },
      );
      setBusy(null);
    }
  }

  return (
    <form
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={(e) => create(!aiLocked && cvs.length > 0, e)}
      aria-label={type.title}
    >
      <Link
        href="/letters/new"
        className="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline"
      >
        <ArrowLeft aria-hidden size={16} /> All letter types
      </Link>
      <div>
        <h2 className="font-display text-2xl font-semibold">{type.title}</h2>
        <p className="text-ink-muted">{type.description}</p>
      </div>
      {type.id === 'cover' && (
        <Banner tone="info" title="Applying for a specific advert?">
          Save the job in{' '}
          <Link href="/jobs?new=1" className="text-primary font-semibold">
            Jobs
          </Link>{' '}
          and write the letter there: it’s matched to what the advert asks for.
        </Banner>
      )}
      {type.questions.map((q) =>
        q.long ? (
          <TextArea
            key={q.id}
            label={q.label}
            hint={q.hint}
            optional={!q.required}
            rows={3}
            maxLength={1500}
            value={answers[q.id] ?? ''}
            error={
              touched && q.required && !(answers[q.id] ?? '').trim()
                ? 'Please answer this.'
                : undefined
            }
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
          />
        ) : (
          <TextField
            key={q.id}
            label={q.label}
            hint={q.hint}
            optional={!q.required}
            maxLength={300}
            value={answers[q.id] ?? ''}
            error={
              touched && q.required && !(answers[q.id] ?? '').trim()
                ? 'Please answer this.'
                : undefined
            }
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
          />
        ),
      )}
      <TextArea
        label="Who it’s to"
        hint={`One line each: name, organisation, address. Usually: ${type.to}.`}
        optional
        rows={2}
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      {cvs.length > 0 && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Design and contact details from
          <select
            className="border-line-strong bg-surface min-h-11 rounded-md border px-3 text-[15px] font-normal"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            {cvs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.role === 'profile' ? 'Career profile' : c.title || c.name || 'Untitled CV'}
              </option>
            ))}
          </select>
        </label>
      )}
      <div role="radiogroup" aria-label="Tone" className="flex gap-2">
        {(['warm', 'formal'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tone === t}
            onClick={() => setTone(t)}
            className={
              tone === t
                ? 'border-primary bg-primary-soft text-primary min-h-10 rounded-full border-2 px-3.5 text-sm font-semibold'
                : 'border-line-strong bg-surface hover:bg-sunken min-h-10 rounded-full border px-3.5 text-sm font-semibold'
            }
          >
            {t === 'warm' ? 'Warm' : 'Formal'}
          </button>
        ))}
      </div>
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
      {touched && missing.length > 0 && (
        <p className="text-danger text-sm" role="alert">
          Answer “{missing[0]!.label}” to continue.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {cvs.length > 0 && (
          <Button
            type="button"
            icon={aiLocked ? <Lock aria-hidden size={18} /> : <Sparkles aria-hidden size={18} />}
            disabled={busy !== null || aiLocked}
            loading={busy === 'ai'}
            onClick={() => create(true)}
            title={aiLocked ? 'AI drafts are part of Premium' : undefined}
          >
            Write it with AI
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          icon={<PenLine aria-hidden size={18} />}
          disabled={busy !== null}
          loading={busy === 'self'}
          onClick={() => create(false)}
        >
          Write it myself
        </Button>
      </div>
      {aiLocked && cvs.length > 0 && (
        <p className="text-ink-muted text-sm">
          “Write it myself” starts you with a draft made from your answers. AI drafts are part of{' '}
          <Link href="/premium" className="text-primary font-semibold">
            Premium
          </Link>
          .
        </p>
      )}
      {cvs.length === 0 && (
        <p className="text-ink-muted text-sm">
          Tip:{' '}
          <Link href="/start" className="text-primary font-semibold">
            create a CV
          </Link>{' '}
          first, so the letter uses your name, contact details and design.
        </p>
      )}
    </form>
  );
}
