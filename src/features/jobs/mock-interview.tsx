'use client';

import { useState } from 'react';
import { CircleAlert, CircleCheck, MessageCircle, RotateCcw, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/field';
import { MOCK_QUESTIONS, type MockFeedback } from '@/modules/jobs/mock';
import type { Job } from '@/modules/jobs/schema';
import type { ResumeDocument } from '@/modules/resume/schema';
import { cn } from '@/lib/cn';
import { jobAiApi } from './api';

const VERDICT = {
  strong: { label: 'Strong answer', cls: 'text-success', Icon: CircleCheck },
  good: { label: 'Good answer', cls: 'text-primary', Icon: CircleCheck },
  'work-on': { label: 'Work on this one', cls: 'text-warning', Icon: CircleAlert },
} as const;

function Feedback({ f }: { f: MockFeedback }) {
  const v = VERDICT[f.verdict];
  return (
    <div
      className="border-line bg-surface flex flex-col gap-2 rounded-lg border p-3 text-sm"
      data-testid="mock-feedback"
    >
      <p className={cn('flex items-center gap-1.5 font-semibold', v.cls)}>
        <v.Icon aria-hidden size={16} /> {v.label}
      </p>
      <ul className="flex flex-wrap gap-1.5" aria-label="STAR structure">
        {(['situation', 'task', 'action', 'result'] as const).map((k) => (
          <li
            key={k}
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
              f.star[k] ? 'bg-success-soft text-success' : 'bg-sunken text-ink-muted',
            )}
          >
            {f.star[k] ? '✓ ' : ''}
            {k}
          </li>
        ))}
      </ul>
      {f.quote && <p className="text-ink-muted italic">About “{f.quote}”</p>}
      {f.strengths.length > 0 && (
        <ul className="list-disc pl-5">
          {f.strengths.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {f.improve.length > 0 && (
        <ul className="text-ink list-disc pl-5" aria-label="To improve">
          {f.improve.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {f.tip && <p className="bg-primary-soft/60 rounded-md p-2">{f.tip}</p>}
    </div>
  );
}

/**
 * Mock interview (spec §10.3): the AI asks one question at a time for this job; after each
 * answer it gives feedback on structure (STAR) and relevance, quoting the person's own words.
 */
export function MockInterview({
  job,
  source,
  disabled,
  onJobChange,
  onError,
  refresh,
}: {
  job: Job;
  source: ResumeDocument | null;
  disabled: boolean;
  onJobChange: (j: Job) => void;
  onError: (e: unknown) => void;
  refresh: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const m = job.mock;
  const turn = async (opts: { answer?: string; restart?: boolean }) => {
    if (!source) return;
    setBusy(true);
    try {
      onJobChange(await jobAiApi.mockTurn(job.id, source, opts));
      setAnswer('');
      refresh();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const asked = m ? m.turns.length + (m.current ? 1 : 0) : 0;

  return (
    <section
      id="mock"
      aria-label="Mock interview"
      className="border-line flex scroll-mt-20 flex-col gap-4 border-t pt-5"
      data-testid="mock"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <MessageCircle aria-hidden size={18} /> Mock interview
        </h3>
        {m && (
          <span className="text-ink-muted text-sm" data-testid="mock-progress">
            {m.current ? `Question ${asked} of ${MOCK_QUESTIONS}` : 'Finished'}
          </span>
        )}
      </div>
      {m && (
        <div
          className="bg-sunken h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Interview progress"
          aria-valuemin={0}
          aria-valuemax={MOCK_QUESTIONS}
          aria-valuenow={m.turns.length}
        >
          <div
            className="bg-primary h-full"
            style={{ width: `${(m.turns.length / MOCK_QUESTIONS) * 100}%` }}
          />
        </div>
      )}
      {!m && (
        <p className="text-ink-muted text-sm">
          Practise out loud or in writing: {MOCK_QUESTIONS} questions for this job, one at a time,
          with feedback after each answer.
        </p>
      )}
      {m && (
        <ol className="flex flex-col gap-4" aria-label="Interview so far">
          {m.turns.map((t, i) => (
            <li key={i} className="flex flex-col gap-2">
              <p className="bg-primary-soft max-w-[85%] self-start rounded-lg rounded-tl-sm px-3 py-2 font-semibold">
                {t.question}
              </p>
              <p className="bg-surface border-line max-w-[85%] self-end rounded-lg rounded-tr-sm border px-3 py-2 text-sm whitespace-pre-line">
                {t.answer}
              </p>
              <Feedback f={t.feedback} />
            </li>
          ))}
        </ol>
      )}
      {m?.current && (
        <div className="flex flex-col gap-3">
          <p
            className="bg-primary-soft max-w-[85%] self-start rounded-lg rounded-tl-sm px-3 py-2 font-semibold"
            data-testid="mock-question"
          >
            {m.current.question}
          </p>
          <TextArea
            label="Your answer"
            hint="Answer as you would in the interview. Try: the situation, what you had to do, what you did, and the result."
            rows={5}
            maxLength={3000}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <Button
            className="self-start"
            icon={<Send aria-hidden size={18} />}
            loading={busy}
            disabled={disabled || busy || answer.trim().length < 10}
            onClick={() => turn({ answer })}
          >
            Send answer
          </Button>
        </div>
      )}
      {m && !m.current && m.summary && (
        <div className="bg-primary-soft/60 rounded-lg p-3 text-sm" data-testid="mock-summary">
          <p className="mb-1 font-semibold">How it went</p>
          <p>{m.summary}</p>
        </div>
      )}
      {(!m || !m.current) && (
        <Button
          variant={m ? 'secondary' : 'primary'}
          className="self-start"
          icon={m ? <RotateCcw aria-hidden size={18} /> : <Sparkles aria-hidden size={18} />}
          loading={busy}
          disabled={disabled || busy}
          onClick={() => turn({ restart: true })}
        >
          {m ? 'Practise again' : 'Start the mock interview'}
        </Button>
      )}
      {m?.current && m.turns.length > 0 && (
        <button
          type="button"
          className="text-ink-muted self-start text-sm underline"
          disabled={busy}
          onClick={() => {
            if (confirm('Start a new mock interview? This one will be cleared.'))
              void turn({ restart: true });
          }}
        >
          Start over
        </button>
      )}
    </section>
  );
}
