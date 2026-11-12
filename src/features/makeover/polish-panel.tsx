'use client';

import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  gapFindings,
  polishContext,
  polishLines,
  type Chip,
  type Suggestion,
} from '@/modules/makeover/polish';
import type { ResumeDocument } from '@/modules/resume/schema';

const CHIP_LABEL: Record<Chip, (n: number) => string> = {
  wording: (n) => `Fix ${n} wording issue${n === 1 ? '' : 's'}`,
  bullets: (n) => `Strengthen ${n} bullet${n === 1 ? '' : 's'}`,
  gaps: (n) => `Fill ${n} gap${n === 1 ? '' : 's'}`,
};

type Denied = { message: string; reason?: string };

/**
 * Optional polish (spec §6.1, §6.4): three chips with counts. Opening a chip shows before/after
 * pairs; nothing changes until the person accepts.
 */
export function PolishChips({
  doc,
  makeoverId,
  counts,
  ai,
  onAccept,
  onBasics,
}: {
  doc: ResumeDocument;
  makeoverId: string;
  counts: Record<Chip, number>;
  ai: boolean;
  onAccept: (s: Suggestion[]) => void;
  onBasics: (patch: Partial<ResumeDocument['basics']>) => void;
}) {
  const [open, setOpen] = useState<Chip | null>(null);
  const chips = (['wording', 'bullets', 'gaps'] as const).filter(
    (c) => counts[c] > 0 && (c === 'gaps' || ai),
  );
  if (!chips.length) return null;
  return (
    <div className="flex flex-col gap-3" data-testid="polish">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            aria-expanded={open === c}
            onClick={() => setOpen(open === c ? null : c)}
            data-testid={`chip-${c}`}
            className={
              open === c
                ? 'border-primary bg-primary-soft text-primary inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold'
                : 'border-line-strong bg-surface hover:bg-sunken inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold'
            }
          >
            {c !== 'gaps' && <Sparkles aria-hidden size={15} />}
            {CHIP_LABEL[c](counts[c])}
          </button>
        ))}
      </div>
      {open === 'gaps' && <GapsList doc={doc} onBasics={onBasics} />}
      {(open === 'wording' || open === 'bullets') && (
        <Suggestions
          key={open}
          chip={open}
          doc={doc}
          makeoverId={makeoverId}
          onAccept={(s) => {
            onAccept(s);
          }}
        />
      )}
    </div>
  );
}

function Suggestions({
  chip,
  doc,
  makeoverId,
  onAccept,
}: {
  chip: 'wording' | 'bullets';
  doc: ResumeDocument;
  makeoverId: string;
  onAccept: (s: Suggestion[]) => void;
}) {
  const [state, setState] = useState<
    | { s: 'idle' }
    | { s: 'busy' }
    | { s: 'done'; items: Suggestion[]; decided: Record<string, 'yes' | 'no'> }
    | { s: 'denied'; d: Denied }
  >({ s: 'idle' });
  // The lines as they were when the chip was opened (accepted changes update the document).
  const [lines] = useState(() => polishLines(doc, chip));
  const [before] = useState(() => new Map(lines.map((l) => [l.id, l.text])));

  async function run() {
    setState({ s: 'busy' });
    try {
      const r = await fetch('/api/makeover/polish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          makeoverId,
          input: { chip, presetId: doc.presetId, items: lines, context: polishContext(doc) },
        }),
      });
      const j = (await r.json().catch(() => null)) as
        | { items: Suggestion[] }
        | { error: { message: string; details?: { reason?: string } } }
        | null;
      if (!r.ok || !j || 'error' in j)
        return setState({
          s: 'denied',
          d: {
            message:
              (j && 'error' in j && j.error.message) || 'That didn’t work. Please try again.',
            reason: j && 'error' in j ? j.error.details?.reason : undefined,
          },
        });
      setState({ s: 'done', items: j.items, decided: {} });
    } catch {
      setState({ s: 'denied', d: { message: 'That didn’t work. Please try again.' } });
    }
  }

  if (state.s === 'idle')
    return (
      <Card className="flex flex-col items-start gap-3 p-4">
        <p className="text-[15px]">
          {chip === 'wording'
            ? 'We’ll suggest fixes for spelling, grammar and “I/my” wording. Names, numbers, dates and employers are never changed.'
            : 'We’ll suggest stronger openings for weak points. Nothing is added that isn’t already in your CV.'}
        </p>
        <Button size="sm" onClick={run} icon={<Sparkles aria-hidden size={16} />}>
          Show suggestions
        </Button>
      </Card>
    );
  if (state.s === 'busy')
    return (
      <Card className="flex items-center gap-3 p-4" role="status">
        <Spinner /> Checking your lines…
      </Card>
    );
  if (state.s === 'denied')
    return (
      <Card className="flex flex-col items-start gap-3 p-4" data-testid="polish-denied">
        <p>{state.d.message}</p>
        {state.d.reason === 'sign_in' && (
          <ButtonLink size="sm" href="/signin?next=/makeover%3Fresume%3D1">
            Sign in
          </ButtonLink>
        )}
        {(state.d.reason === 'premium' || state.d.reason === 'limit') && (
          <ButtonLink size="sm" href="/premium">
            See Premium
          </ButtonLink>
        )}
      </Card>
    );

  const open = state.items.filter((it) => !state.decided[it.id]);
  const decide = (ids: string[], v: 'yes' | 'no') => {
    const accepted = state.items.filter((it) => ids.includes(it.id) && v === 'yes');
    if (accepted.length) onAccept(accepted);
    setState({
      ...state,
      decided: { ...state.decided, ...Object.fromEntries(ids.map((id) => [id, v])) },
    });
  };
  if (!state.items.length)
    return (
      <Card className="p-4" data-testid="polish-none">
        No changes needed — these lines already read well.
      </Card>
    );
  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="polish-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {open.length ? `${open.length} suggestion${open.length === 1 ? '' : 's'}` : 'All done'}
        </p>
        {open.length > 1 && (
          <Button
            size="sm"
            onClick={() =>
              decide(
                open.map((o) => o.id),
                'yes',
              )
            }
          >
            Accept all
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {state.items.map((it) => {
          const d = state.decided[it.id];
          return (
            <li key={it.id} className="border-line rounded-md border p-3" data-testid="suggestion">
              <p className="text-ink-muted text-sm line-through">{before.get(it.id)}</p>
              <p className="mt-1 text-[15px] font-medium">{it.after}</p>
              {it.reason && <p className="text-ink-subtle mt-1 text-xs">{it.reason}</p>}
              <div className="mt-2 flex gap-2">
                {d ? (
                  <span className="text-ink-muted inline-flex items-center gap-1 text-sm">
                    {d === 'yes' ? (
                      <>
                        <Check aria-hidden size={15} /> Accepted
                      </>
                    ) : (
                      <>
                        <X aria-hidden size={15} /> Skipped
                      </>
                    )}
                  </span>
                ) : (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => decide([it.id], 'yes')}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decide([it.id], 'no')}>
                      Skip
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const BASIC_FIELDS: {
  key: 'name' | 'email' | 'phone' | 'location';
  ids: string[];
  label: string;
}[] = [
  { key: 'name', ids: ['name'], label: 'Your name' },
  { key: 'email', ids: ['contact', 'email-format'], label: 'Email' },
  { key: 'phone', ids: ['contact', 'phone-format'], label: 'Phone' },
  { key: 'location', ids: ['location'], label: 'Town or city' },
];

/** "Fill gaps": questions only the person can answer. Nothing is guessed. */
function GapsList({
  doc,
  onBasics,
}: {
  doc: ResumeDocument;
  onBasics: (patch: Partial<ResumeDocument['basics']>) => void;
}) {
  const findings = gapFindings(doc);
  const ids = new Set(findings.map((f) => f.id));
  const fields = BASIC_FIELDS.filter((f) => f.ids.some((id) => ids.has(id)));
  const others = findings.filter((f) => !BASIC_FIELDS.some((b) => b.ids.includes(f.id)));
  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="gaps-list">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm font-semibold">
          {f.label}
          <input
            className="border-line-strong bg-surface h-11 rounded-md border px-3 text-[15px] font-normal"
            defaultValue={doc.basics[f.key]}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== doc.basics[f.key]) onBasics({ [f.key]: v });
            }}
          />
        </label>
      ))}
      {others.length > 0 && (
        <ul className="flex flex-col gap-2 text-[15px]">
          {others.map((f) => (
            <li key={f.id}>
              <span className="font-semibold">{f.title}.</span>{' '}
              <span className="text-ink-muted">{f.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <p className="text-ink-subtle text-sm">You can fill these in the editor after saving.</p>
      )}
    </Card>
  );
}
