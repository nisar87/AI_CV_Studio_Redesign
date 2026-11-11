'use client';

import { useId, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiBadge } from '@/features/ai/suggestion';
import { callAi, useAi } from '@/features/ai/client';

/** "Describe what you need" on the Start page. Creates the CV directly from the AI's choice. */
export function DescribeBox({ onCreate }: { onCreate: (href: string) => void }) {
  const ai = useAi();
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!ai.show) return null;

  async function submit() {
    setBusy(true);
    setError('');
    const r = await callAi('intake.interpret', { description: text.trim().slice(0, 600) });
    if (!r.ok) {
      setBusy(false);
      setError(`${r.message} You can also choose from the list below.`);
      return;
    }
    const { presetId, targetTitle, design } = r.data.result;
    const q = new URLSearchParams({
      work: presetId,
      design: design.templateId,
      accent: design.accent,
      font: design.fontPair,
      density: design.density,
      ...(targetTitle ? { title: targetTitle } : {}),
    });
    onCreate(`/cv/new?${q.toString()}`);
  }

  return (
    <section
      aria-labelledby={id}
      className="border-primary/25 bg-primary-soft/60 mb-6 flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-[19px] font-semibold">
          Describe what you need
        </h2>
        <AiBadge demo={ai.demo} />
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 3) void submit();
        }}
      >
        <label htmlFor={`${id}-in`} className="sr-only">
          Describe the CV you need
        </label>
        <input
          id={`${id}-in`}
          value={text}
          maxLength={600}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. A simple CV for a delivery driver"
          className="border-line-strong bg-surface focus-visible:border-primary focus-visible:ring-primary/25 h-12 min-w-0 flex-1 rounded-sm border px-3 text-base focus-visible:ring-3 focus-visible:outline-none"
        />
        <Button
          type="submit"
          size="lg"
          icon={<Sparkles aria-hidden size={18} />}
          loading={busy}
          loadingText="Setting up…"
          disabled={text.trim().length < 3}
        >
          Create my CV
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-danger text-[15px]">
          {error}
        </p>
      ) : (
        <p className="text-ink-muted text-sm">
          Say what job you want and any style you like. We set up the right sections and a matching
          design — you can change everything later.
        </p>
      )}
    </section>
  );
}
