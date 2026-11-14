'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { MessageSquare, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentPreview } from '@/features/preview/document-preview';
import type { ResumeDocument } from '@/modules/resume/schema';
import { buildDocumentHtml } from '@/modules/templates/build-document';
import { ReviewPanel, type ReviewPanelHandle } from './review-panel';

export function SharedCv({
  doc,
  token,
  comments = false,
}: {
  doc: ResumeDocument;
  token: string;
  /** The owner lets people with this link leave comments. */
  comments?: boolean;
}) {
  const name = doc.basics.name || 'CV';
  const review = useRef<ReviewPanelHandle>(null);
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
        <div
          className={`mx-auto flex ${comments ? 'max-w-[1280px]' : 'max-w-[960px]'} flex-wrap items-center justify-between gap-3 px-4 py-3`}
        >
          <div>
            <h1 className="font-display text-xl leading-tight font-semibold">{name}</h1>
            {doc.basics.headline && <p className="text-ink-muted text-sm">{doc.basics.headline}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {comments && (
              <a
                href="#review-h"
                className="border-line-strong text-ink hover:bg-sunken inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold lg:hidden"
              >
                <MessageSquare aria-hidden size={16} /> Comment
              </a>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer aria-hidden size={16} />}
              onClick={print}
            >
              Print or save as PDF
            </Button>
          </div>
        </div>
      </header>
      {comments ? (
        <main
          id="main"
          className="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <DocumentPreview
            doc={doc}
            title={`${name} — CV. Click a line to comment on it.`}
            onSelect={(ref, text) => review.current?.pick(ref, text ?? '')}
          />
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
            <ReviewPanel ref={review} token={token} doc={doc} ownerName={doc.basics.name} />
          </div>
        </main>
      ) : (
        <main id="main" className="mx-auto w-full max-w-[960px] flex-1 px-4 py-6">
          <DocumentPreview doc={doc} title={`${name} — CV`} />
        </main>
      )}
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
