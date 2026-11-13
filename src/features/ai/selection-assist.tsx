'use client';

import { useRef, useState, type SyntheticEvent } from 'react';
import { Languages, Scissors, SpellCheck, Sparkles, Wand2 } from 'lucide-react';
import { useAi } from './client';
import { AskText, SuggestionCard, useSuggestion } from './suggestion';

type Mode = 'improve' | 'shorten' | 'expand' | 'grammar' | 'tone';
const MODES: { mode: Mode; label: string; icon: typeof Wand2 }[] = [
  { mode: 'improve', label: 'Improve', icon: Wand2 },
  { mode: 'shorten', label: 'Shorten', icon: Scissors },
  { mode: 'expand', label: 'Expand', icon: Sparkles },
  { mode: 'grammar', label: 'Fix grammar', icon: SpellCheck },
  { mode: 'tone', label: 'More formal', icon: Languages },
];

/**
 * AI on a selection (complete-studio-spec §9.1): select words in a text box and a small toolbar
 * offers Improve · Shorten · Expand · Fix grammar · Change tone for just those words. The result is
 * shown as before → after and replaces the selection only when the person uses it (one undo step).
 */
export function useSelectionAssist(value: string, onReplace: (next: string) => void) {
  const ai = useAi();
  const s = useSuggestion('write.rewrite');
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const asked = useRef<{ start: number; end: number; text: string } | null>(null);

  const onSelect = (
    e: SyntheticEvent<HTMLTextAreaElement> | { currentTarget: HTMLTextAreaElement },
  ) => {
    const t = e.currentTarget;
    const text = value.slice(t.selectionStart, t.selectionEnd);
    setSel(text.trim().length >= 3 ? { start: t.selectionStart, end: t.selectionEnd } : null);
  };
  const run = (mode: Mode, label: string) => {
    if (!sel) return;
    const text = value.slice(sel.start, sel.end);
    asked.current = { ...sel, text };
    void s.run({ text, mode, tone: 'formal', context: value.slice(0, 3000) }, label);
  };

  const toolbar = !ai.show ? null : (
    <>
      {sel && s.state.kind === 'idle' && (
        <div
          role="toolbar"
          aria-label="Rewrite the selected words"
          className="border-primary/30 bg-primary-soft/60 flex flex-wrap items-center gap-1 rounded-md border p-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-primary px-1.5 text-xs font-semibold">Selection:</span>
          {MODES.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => run(mode, label)}
              className="text-ink hover:bg-surface inline-flex min-h-9 items-center gap-1 rounded px-2 text-sm font-semibold"
            >
              <Icon aria-hidden size={14} /> {label}
            </button>
          ))}
        </div>
      )}
      <SuggestionCard
        s={s}
        demo={ai.demo}
        useLabel="Replace the selection"
        onUse={(d) => {
          const a = asked.current;
          // Only if the text box still has those words where they were.
          if (a && value.slice(a.start, a.end) === a.text)
            onReplace(value.slice(0, a.start) + d.result.text + value.slice(a.end));
          s.dismiss();
          setSel(null);
        }}
      >
        {(d) => (
          <p className="flex flex-col gap-1">
            <span className="text-ink-muted line-through">{asked.current?.text}</span>
            <span>
              <AskText text={d.result.text} />
            </span>
          </p>
        )}
      </SuggestionCard>
    </>
  );
  // Selections made with the mouse or keyboard (React's onSelect misses some of them).
  return { onSelect, onMouseUp: onSelect, onKeyUp: onSelect, toolbar };
}
