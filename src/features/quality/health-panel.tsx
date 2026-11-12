'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Lightbulb } from 'lucide-react';
import { healthCheck, type Finding } from '@/modules/quality/health';
import type { ResumeDocument } from '@/modules/resume/schema';

/** CV health check: what to fix before sending, what could be stronger, and what is already good. */
export function HealthPanel({ doc, pages }: { doc: ResumeDocument; pages?: number }) {
  const report = useMemo(() => healthCheck(doc, { pages }), [doc, pages]);
  const [showPassed, setShowPassed] = useState(false);
  const fixes = report.findings.filter((f) => f.severity === 'fix');
  const improve = report.findings.filter((f) => f.severity === 'improve');

  return (
    <section
      aria-labelledby="health-h"
      className="border-line bg-surface shadow-1 rounded-lg border p-5"
      data-testid="health"
    >
      <h2 id="health-h" className="font-semibold">
        CV check
      </h2>
      <p className="text-ink-muted mb-4 text-sm" aria-live="polite">
        {fixes.length
          ? `${fixes.length} thing${fixes.length === 1 ? '' : 's'} to fix before you send it`
          : improve.length
            ? 'Ready to send. A few ideas could make it stronger.'
            : 'Ready to send. Nothing to fix.'}
      </p>
      {fixes.length > 0 && <Group title="Fix before sending" items={fixes} doc={doc} tone="fix" />}
      {improve.length > 0 && (
        <Group title="Could be stronger" items={improve} doc={doc} tone="improve" />
      )}
      {report.passed.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="text-primary text-sm font-semibold"
            aria-expanded={showPassed}
            onClick={() => setShowPassed((v) => !v)}
          >
            {showPassed ? 'Hide' : 'Show'} what’s already good ({report.passed.length})
          </button>
          {showPassed && (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {report.passed.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <CircleCheck aria-hidden size={18} className="text-success mt-0.5 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Group({
  title,
  items,
  doc,
  tone,
}: {
  title: string;
  items: Finding[];
  doc: ResumeDocument;
  tone: 'fix' | 'improve';
}) {
  const Icon = tone === 'fix' ? CircleAlert : Lightbulb;
  return (
    <div className="mb-4">
      <h3 className="text-ink-muted mb-2 text-xs font-semibold tracking-wide uppercase">{title}</h3>
      <ul className="flex flex-col gap-3">
        {items.map((f) => (
          <li key={f.id} className="flex items-start gap-2.5" data-finding={f.id}>
            <Icon
              aria-hidden
              size={20}
              className={
                tone === 'fix' ? 'text-danger mt-0.5 shrink-0' : 'text-warning mt-0.5 shrink-0'
              }
            />
            <div className="min-w-0">
              <p className="font-semibold">
                <span className="sr-only">{tone === 'fix' ? 'To fix: ' : 'Idea: '}</span>
                {f.title}
              </p>
              <p className="text-ink-muted text-sm">{f.detail}</p>
              {f.examples && f.examples.length > 0 && (
                <ul className="text-ink-muted mt-1 text-sm">
                  {f.examples.map((e) => (
                    <li key={e} className="truncate">
                      “{e}”
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/cv/${doc.id}${f.ref ? `?focus=${encodeURIComponent(f.ref)}` : ''}`}
                className="text-primary mt-1 inline-block text-sm font-semibold underline underline-offset-4"
              >
                Show me
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
