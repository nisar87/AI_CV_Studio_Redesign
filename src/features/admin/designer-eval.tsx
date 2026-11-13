'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import type { DesignEvalResult } from '@/modules/ai/design-eval';
import { adminGet, adminSend } from './api';

type Sample = { index: number; name: string; kind: string };

/**
 * Console → AI → Designer evaluation (complete-studio-spec §7.8): 60 written descriptions, refine
 * samples and a prompt-injection sample, run live on the server in batches of 4.
 */
export function DesignerEval() {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [results, setResults] = useState<DesignEvalResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  useEffect(() => {
    adminGet<{ samples: Sample[] }>('/api/admin/ai/design-eval').then(
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
        const b = await adminSend<{ results: DesignEvalResult[] }>(
          '/api/admin/ai/design-eval',
          'POST',
          {
            from,
            count: 4,
          },
        );
        setResults((r) => [...r, ...b.results]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };
  const compose = results.filter((r) => r.kind === 'compose');
  const valid = compose.filter((r) => (r.candidates ?? 0) >= 2).length;
  const fullMatch = compose.filter((r) => r.ok && (r.missed ?? []).length === 0).length;
  const ms = compose.map((r) => r.ms).sort((a, b) => a - b);
  const median = ms.length ? ms[Math.floor(ms.length / 2)]! : 0;
  const refineOk = results.filter((r) => r.kind === 'refine' && r.ok).length;
  const refineAll = results.filter((r) => r.kind === 'refine').length;
  const inject = results.find((r) => r.kind === 'inject');

  return (
    <section className="mt-12" aria-labelledby="designer-eval-h" data-testid="designer-eval">
      <h2 id="designer-eval-h" className="text-xl font-semibold">
        AI Designer evaluation
      </h2>
      <p className="text-ink-muted mt-1 mb-4 max-w-3xl">
        60 written design descriptions (each must give at least 2 valid designs; the automatic check
        compares the first design with what was asked — review the misses by eye), refine requests
        (only the named settings may change) and a prompt-injection test.
      </p>
      {error && <Banner tone="error" title={error} className="mb-4" />}
      <div className="mb-4">
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
            Run Designer evaluation ({samples?.length ?? '…'} samples)
          </Button>
        )}
      </div>
      {results.length > 0 && (
        <p className="mb-4 text-sm" data-testid="designer-eval-summary" aria-live="polite">
          Descriptions: {valid}/{compose.length} gave 2+ valid designs · {fullMatch}/
          {compose.length} first designs matched every check · median {(median / 1000).toFixed(1)} s
          · refine {refineOk}/{refineAll} · injection{' '}
          {inject ? (inject.ok ? 'passed' : 'FAILED') : '…'}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {results.map((r) => (
          <li key={r.index} className="border-line bg-surface rounded-md border p-3 text-sm">
            <p className="font-semibold">
              {r.index + 1}. {r.name}{' '}
              <span className="text-ink-muted font-normal">
                · {r.kind} · {(r.ms / 1000).toFixed(1)} s {r.ok ? '' : '· FAILED'}
              </span>
            </p>
            {r.error && <p className="text-danger">{r.error}</p>}
            {r.missed && r.missed.length > 0 && (
              <p className="text-ink-muted">Missed: {r.missed.join(', ')}</p>
            )}
            {r.unmet && r.unmet.length > 0 && (
              <p className="text-ink-muted">Unmet: {r.unmet.join(' | ')}</p>
            )}
            {r.changed && (
              <p className="text-ink-muted">
                Changed: {r.changed.join(', ') || 'nothing'} {r.note ? `— ${r.note}` : ''}
              </p>
            )}
            {r.first && (
              <details>
                <summary className="text-primary cursor-pointer">First design</summary>
                <pre className="bg-sunken mt-1 overflow-x-auto rounded p-2 text-xs whitespace-pre-wrap">
                  {JSON.stringify(r.first, null, 1)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
