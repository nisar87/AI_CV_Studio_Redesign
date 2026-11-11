'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { splitPlaceholders } from '@/modules/ai/placeholders';
import type { AiResponse, TaskId, TaskInput } from '@/modules/ai/schemas';
import { callAi } from './client';

/** "Try again" is capped per field (docs/engineering/ai-architecture.md → Regeneration). */
export const MAX_ATTEMPTS = 5;

type State<T extends TaskId> =
  | { kind: 'idle' }
  | { kind: 'loading'; label: string }
  | { kind: 'done'; data: AiResponse<T>; label: string }
  | { kind: 'error'; message: string; label: string };

/** Runs one AI task for a field and keeps the suggestion state. */
export function useSuggestion<T extends TaskId>(task: T) {
  const [state, setState] = useState<State<T>>({ kind: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const last = useRef<{ input: TaskInput<T>; label: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const run = useCallback(
    async (input: TaskInput<T>, label: string, nextAttempt = 0) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      last.current = { input, label };
      setAttempt(nextAttempt);
      setState({ kind: 'loading', label });
      const r = await callAi(task, input, nextAttempt, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setState(
        r.ok ? { kind: 'done', data: r.data, label } : { kind: 'error', message: r.message, label },
      );
    },
    [task],
  );

  const tryAgain = useCallback(() => {
    if (last.current) void run(last.current.input, last.current.label, attempt + 1);
  }, [attempt, run]);

  const dismiss = useCallback(() => {
    abort.current?.abort();
    setState({ kind: 'idle' });
  }, []);

  return { state, run, tryAgain, dismiss, canRetry: attempt + 1 < MAX_ATTEMPTS };
}

/** Text with `{{?…}}` markers shown as highlighted questions. */
export function AskText({ text }: { text: string }) {
  return (
    <>
      {splitPlaceholders(text).map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : (
          <mark
            key={i}
            className="bg-warning-soft text-ink ring-warning/40 rounded-sm px-1 font-semibold ring-1"
          >
            [{p.text}]
          </mark>
        ),
      )}
    </>
  );
}

export function AiBadge({ demo }: { demo: boolean }) {
  return (
    <span className="text-primary inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
      <Sparkles aria-hidden size={14} />
      {demo ? 'Demo AI' : 'AI suggestion'}
    </span>
  );
}

/** Suggestion card: Use this · Try again · Dismiss. Nothing changes until "Use this". */
export function SuggestionCard<T extends TaskId>({
  s,
  demo,
  children,
  onUse,
  useLabel = 'Use this',
}: {
  s: ReturnType<typeof useSuggestion<T>>;
  demo: boolean;
  children: (data: AiResponse<T>) => ReactNode;
  onUse?: (data: AiResponse<T>) => void;
  useLabel?: string;
}) {
  const { state } = s;
  if (state.kind === 'idle') return null;
  return (
    <section
      aria-live="polite"
      aria-label="AI suggestion"
      data-ai-card={state.kind}
      className={cn(
        'mt-2 flex flex-col gap-3 rounded-md border p-3',
        state.kind === 'error'
          ? 'border-danger/30 bg-danger-soft'
          : 'border-primary/30 bg-primary-soft',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <AiBadge demo={demo} />
        <span className="text-ink-muted text-xs">{state.label}</span>
      </div>
      {state.kind === 'loading' && (
        <p className="text-ink-muted flex items-center gap-2 text-[15px]">
          <Spinner size={16} /> Writing a suggestion…
        </p>
      )}
      {state.kind === 'error' && <p className="text-ink text-[15px]">{state.message}</p>}
      {state.kind === 'done' && (
        <>
          <div className="text-ink text-[15px] leading-6">{children(state.data)}</div>
          {state.data.needsInput.length > 0 && (
            <p className="text-ink-muted text-sm">
              Highlighted parts need a real detail from you — we never guess facts. Replace them
              after you use this.
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {state.kind === 'done' && onUse && (
          <Button
            size="sm"
            icon={<Check aria-hidden size={16} />}
            onClick={() => onUse(state.data)}
          >
            {useLabel}
          </Button>
        )}
        {state.kind !== 'loading' && s.canRetry && (
          <Button
            size="sm"
            variant="secondary"
            icon={<RotateCcw aria-hidden size={16} />}
            onClick={s.tryAgain}
          >
            Try again
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<X aria-hidden size={16} />} onClick={s.dismiss}>
          {state.kind === 'loading' ? 'Cancel' : 'Dismiss'}
        </Button>
      </div>
    </section>
  );
}

/** Shown under a field whose text still contains `{{?…}}` markers. */
export function NeedsInputHint({ texts }: { texts: string[] }) {
  const has = texts.some((t) => /\{\{\?[^{}]+\}\}/.test(t));
  if (!has) return null;
  return (
    <p className="text-ink bg-warning-soft rounded-sm px-2 py-1.5 text-sm" data-needs-input>
      Replace the parts in <strong>{'{{?…}}'}</strong> with your real details before you send your
      CV.
    </p>
  );
}
