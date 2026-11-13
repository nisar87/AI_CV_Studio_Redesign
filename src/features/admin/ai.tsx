'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { AdminHeading } from './admin-shell';
import { adminGet, adminSend } from './api';
import { DesignerEval } from './designer-eval';

type Sample = { index: number; name: string; task: string };
type Result = {
  index: number;
  name: string;
  task: string;
  ok: boolean;
  error?: string;
  output?: unknown;
  caught: string[];
  residual: string[];
  problems?: string[];
  ms: number;
};
type Batch = {
  mode: string;
  models: { fast: string; smart: string };
  total: number;
  results: Result[];
};

/**
 * Console → AI: the live evaluation (launch gate) runs on the server, where Gemini is reachable,
 * in batches of 4. The pass mark is 0 unmarked new facts.
 */
export function AdminAi() {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [info, setInfo] = useState<Pick<Batch, 'mode' | 'models'> | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    adminGet<{ samples: Sample[] }>('/api/admin/ai/eval').then(
      (r) => setSamples(r.samples),
      (e: Error) => setError(e.message),
    );
  }, []);

  const run = async () => {
    if (!samples) return;
    setRunning(true);
    setError(null);
    setResults([]);
    stop.current = false;
    try {
      for (let from = 0; from < samples.length && !stop.current; from += 4) {
        const b = await adminSend<Batch>('/api/admin/ai/eval', 'POST', { from, count: 4 });
        setInfo({ mode: b.mode, models: b.models });
        setResults((r) => [...r, ...b.results]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const done = results.length;
  const failed = results.filter((r) => !r.ok).length;
  const caught = results.reduce((n, r) => n + r.caught.length, 0);
  const residual = results.reduce((n, r) => n + r.residual.length, 0);
  const problems = results.reduce((n, r) => n + (r.problems?.length ?? 0), 0);
  const finished = !!samples && done === samples.length;

  return (
    <>
      <AdminHeading
        title="AI"
        intro="Run the live evaluation before relying on AI help: every writing task over realistic CVs and messy notes. It passes with 0 unmarked new facts."
      />
      {error && (
        <Banner tone="error" title="The evaluation stopped" className="mb-4">
          {error}
        </Banner>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {running ? (
          <Button
            variant="secondary"
            icon={<Square aria-hidden size={16} />}
            onClick={() => (stop.current = true)}
          >
            Stop
          </Button>
        ) : (
          <Button icon={<Play aria-hidden size={16} />} onClick={run} disabled={!samples}>
            Run evaluation ({samples?.length ?? '…'} samples)
          </Button>
        )}
        {info && (
          <span className="text-ink-muted text-sm">
            Provider {info.mode} · {info.models.fast}
          </span>
        )}
      </div>
      {done > 0 && (
        <div
          className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"
          data-testid="eval-summary"
          aria-live="polite"
        >
          <Stat label="Samples done" value={`${done}${samples ? ` / ${samples.length}` : ''}`} />
          <Stat label="Failed calls" value={String(failed)} />
          <Stat label="Facts caught by the guard" value={String(caught)} />
          <Stat
            label="Unmarked new facts (must be 0)"
            value={String(residual)}
            tone={residual ? 'bad' : finished ? 'good' : undefined}
          />
        </div>
      )}
      {finished && (
        <Banner
          tone={residual === 0 && failed === 0 && problems === 0 ? 'success' : 'warning'}
          title={
            residual === 0 && failed === 0 && problems === 0
              ? 'Passed: no invented facts reached the text.'
              : residual
                ? `${residual} unmarked new fact(s) — review the samples marked below.`
                : problems
                  ? `${problems} quality check(s) failed — review the samples marked below.`
                  : `${failed} call(s) failed — run again or check the provider.`
          }
          className="mb-6"
        />
      )}
      <ol className="flex flex-col gap-3" data-testid="eval-results">
        {results.map((r) => (
          <li key={r.index} className="border-line bg-surface rounded-lg border p-4 text-sm">
            <p className="font-semibold">
              {r.index + 1}. {r.name}{' '}
              <span className="text-ink-muted font-normal">
                · {r.task} · {(r.ms / 1000).toFixed(1)} s
              </span>
            </p>
            {!r.ok && <p className="text-danger mt-1">Failed: {r.error}</p>}
            {r.residual.length > 0 && (
              <p className="text-danger mt-1 font-semibold">
                Unmarked new facts: {r.residual.join(', ')}
              </p>
            )}
            {(r.problems?.length ?? 0) > 0 && (
              <p className="text-danger mt-1 font-semibold">
                Quality check: {r.problems!.join(', ')}
              </p>
            )}
            {r.caught.length > 0 && (
              <p className="text-ink-muted mt-1">Guard replaced: {r.caught.join(', ')}</p>
            )}
            {r.ok && (
              <details className="mt-2">
                <summary className="text-primary cursor-pointer">Show the answer</summary>
                <pre className="bg-sunken mt-2 overflow-x-auto rounded p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(r.output, null, 1)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ol>
      <DesignerEval />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="border-line bg-surface rounded-lg border p-4">
      <p className="text-ink-muted text-sm">{label}</p>
      <p
        className={`font-display mt-1 text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-danger' : tone === 'good' ? 'text-[#1f5c2e]' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
