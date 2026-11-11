'use client';

import { useId, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TEMPLATE_CATALOG } from '@/modules/ai/catalog';
import type { DesignChoice } from '@/modules/ai/schemas';
import type { ResumeDocument } from '@/modules/resume/schema';
import { FONT_PAIRS } from '@/modules/templates/fonts';
import { useAi } from './client';
import { SuggestionCard, useSuggestion } from './suggestion';

/** "Describe a style" on the Design tab: words → up to three designs from the catalogue. */
export function StyleAssist({
  doc,
  onApply,
}: {
  doc: ResumeDocument;
  onApply: (d: DesignChoice) => void;
}) {
  const ai = useAi();
  const s = useSuggestion('design.interpret');
  const [text, setText] = useState('');
  const id = useId();
  if (!ai.show) return null;
  const d = doc.design;
  const submit = () =>
    void s.run(
      {
        description: text.trim().slice(0, 400),
        presetId: doc.presetId,
        current: {
          templateId: d.templateId,
          accent: d.accent,
          fontPair: d.fontPair,
          density: d.density,
        },
      },
      'Pick one',
    );
  return (
    <section
      aria-labelledby={id}
      className="bg-primary-soft/60 border-primary/20 flex flex-col gap-2 rounded-lg border p-3"
    >
      <h3 id={id} className="flex items-center gap-1.5 text-[17px] font-semibold">
        <Sparkles aria-hidden size={18} className="text-primary" /> Describe a style
      </h3>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 2) submit();
        }}
      >
        <label htmlFor={`${id}-in`} className="sr-only">
          Describe the look you want
        </label>
        <input
          id={`${id}-in`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          placeholder="e.g. modern, blue, clean and elegant"
          className="border-line-strong bg-surface focus-visible:border-primary focus-visible:ring-primary/25 h-11 min-w-0 flex-1 rounded-sm border px-3 text-base focus-visible:ring-3 focus-visible:outline-none"
        />
        <Button type="submit" disabled={text.trim().length < 2 || s.state.kind === 'loading'}>
          Show me
        </Button>
      </form>
      <SuggestionCard s={s} demo={ai.demo}>
        {(res) => (
          <ul className="grid gap-2" aria-label="Suggested designs">
            {res.result.choices.map((c, i) => {
              const t = TEMPLATE_CATALOG[c.design.templateId];
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      onApply(c.design);
                      s.dismiss();
                      setText('');
                    }}
                    className="border-line bg-surface hover:border-primary flex w-full items-center gap-3 rounded-md border p-2 text-left"
                  >
                    <span className="bg-surface ring-line relative block w-14 shrink-0 overflow-hidden rounded-[3px] ring-1">
                      {/* eslint-disable-next-line @next/next/no-img-element -- static thumbnails */}
                      <img
                        src={`/templates/${c.design.templateId}.webp`}
                        alt=""
                        width={56}
                        height={79}
                        className="block h-auto w-full"
                      />
                      <span
                        aria-hidden
                        className="absolute right-1 bottom-1 size-4 rounded-full ring-2 ring-white"
                        style={{ background: c.design.accent }}
                      />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">
                        {c.name || t.name}
                        {i === 0 && (
                          <span className="text-primary ml-2 text-xs font-semibold uppercase">
                            Best match
                          </span>
                        )}
                      </span>
                      <span className="text-ink-muted text-sm">{c.explanation}</span>
                      <span className="text-ink-subtle text-xs">
                        {t.name} · {FONT_PAIRS[c.design.fontPair].label} · {c.design.density}
                      </span>
                    </span>
                    <span className="text-primary ml-auto shrink-0 pr-1 text-sm font-semibold">
                      Use this
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SuggestionCard>
    </section>
  );
}
