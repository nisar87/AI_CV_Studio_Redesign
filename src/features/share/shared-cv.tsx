'use client';

import Link from 'next/link';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentPreview } from '@/features/preview/document-preview';
import type { ResumeDocument } from '@/modules/resume/schema';
import { buildDocumentHtml } from '@/modules/templates/build-document';

export function SharedCv({ doc }: { doc: ResumeDocument }) {
  const name = doc.basics.name || 'CV';
  function print() {
    const html = buildDocumentHtml(doc, {
      fonts: { kind: 'url', baseUrl: window.location.origin },
      autoPrint: true,
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line bg-surface border-b">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-display text-xl leading-tight font-semibold">{name}</h1>
            {doc.basics.headline && <p className="text-ink-muted text-sm">{doc.basics.headline}</p>}
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer aria-hidden size={16} />}
            onClick={print}
          >
            Print or save as PDF
          </Button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[960px] flex-1 px-4 py-6">
        <DocumentPreview doc={doc} title={`${name} — CV`} />
      </main>
      <footer className="text-ink-muted px-4 pb-8 text-center text-sm">
        Shared with{' '}
        <Link href="/" className="text-primary font-semibold">
          AI CV Studio
        </Link>{' '}
        — make your own professional CV, free.
      </footer>
    </div>
  );
}
