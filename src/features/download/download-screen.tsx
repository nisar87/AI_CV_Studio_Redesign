'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, CircleCheck, CircleDashed, Download, FileJson, Printer } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { DocumentPreview, type PreviewStatus } from '@/features/preview/document-preview';
import { PreviewStatusLine } from '@/features/editor/editor-screen';
import { pdfFilename } from '@/modules/export/filename';
import type { ResumeDocument } from '@/modules/resume/schema';
import { buildDocumentHtml } from '@/modules/templates/build-document';
import { checklist } from './checklist';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function DownloadScreen({ doc }: { doc: ResumeDocument }) {
  const toast = useToast();
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const items = checklist(doc);
  const editHref = `/cv/${doc.id}`;

  async function downloadPdf() {
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: doc }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? 'We couldn’t create the PDF just now.');
      }
      saveBlob(await res.blob(), pdfFilename(doc.basics.name));
      toast.show({ message: 'Your PDF is downloading', tone: 'success' });
    } catch (e) {
      setFailed(
        e instanceof Error && e.message !== 'Failed to fetch'
          ? e.message
          : 'You seem to be offline, or our PDF service is busy.',
      );
    } finally {
      setBusy(false);
    }
  }

  function print() {
    const html = buildDocumentHtml(doc, {
      fonts: { kind: 'url', baseUrl: window.location.origin },
      autoPrint: true,
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const w = window.open(url, '_blank');
    if (!w) toast.show({ message: 'Please allow pop-ups to print your CV', tone: 'error' });
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function backup() {
    const file = {
      app: 'ai-cv-studio',
      version: 1,
      exportedAt: new Date().toISOString(),
      documents: [doc],
    };
    saveBlob(
      new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
      pdfFilename(doc.basics.name).replace(/\.pdf$/, '-backup.json'),
    );
  }

  return (
    <div className="bg-paper flex min-h-dvh flex-col">
      <header className="border-line bg-surface flex h-16 items-center gap-3 border-b px-2 sm:px-4">
        <Link
          href={editHref}
          className="hover:bg-sunken inline-flex h-11 items-center gap-2 rounded-md px-3 text-[15px] font-semibold"
        >
          <ArrowLeft aria-hidden size={20} /> Back to editing
        </Link>
      </header>
      <div className="mx-auto grid w-full max-w-[1200px] flex-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <main id="main" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight">
              Ready to send
            </h1>
            <p className="text-ink-muted">
              A last look before you download. Your PDF will look exactly like the preview.
            </p>
          </div>

          <section
            aria-labelledby="checks"
            className="border-line bg-surface shadow-1 rounded-lg border p-5"
          >
            <h2 id="checks" className="mb-3 font-semibold">
              Quick check
            </h2>
            <ul className="flex flex-col gap-2.5">
              {items.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  {c.ok ? (
                    <CircleCheck aria-hidden size={20} className="text-success mt-0.5 shrink-0" />
                  ) : (
                    <CircleDashed aria-hidden size={20} className="text-warning mt-0.5 shrink-0" />
                  )}
                  <span>
                    <span className="sr-only">{c.ok ? 'Done: ' : 'To check: '}</span>
                    {c.ok ? c.okText : c.todoText}{' '}
                    {!c.ok && (
                      <Link
                        href={editHref}
                        className="text-primary font-semibold underline underline-offset-4"
                      >
                        Fix
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {failed && (
            <Banner
              tone="error"
              title="We couldn’t create the PDF"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={downloadPdf}>
                    Try again
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Printer aria-hidden size={16} />}
                    onClick={print}
                  >
                    Print or save as PDF
                  </Button>
                </div>
              }
            >
              {failed} You can also use your browser’s print window and choose “Save as PDF”.
            </Banner>
          )}

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              icon={<Download aria-hidden size={20} />}
              loading={busy}
              loadingText="Preparing your PDF…"
              onClick={downloadPdf}
            >
              Download PDF
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" icon={<Printer aria-hidden size={18} />} onClick={print}>
                Print
              </Button>
              <Button
                variant="secondary"
                icon={<FileJson aria-hidden size={18} />}
                onClick={backup}
              >
                Save a backup
              </Button>
            </div>
            <p className="text-ink-muted text-sm">
              A backup file lets you open this CV in another browser later.
            </p>
          </div>
        </main>
        <section
          aria-label="Final preview"
          className="bg-sunken flex flex-col gap-3 rounded-lg p-4 sm:p-8"
        >
          <PreviewStatusLine status={status} />
          <DocumentPreview doc={doc} onStatus={setStatus} title="Final preview of your CV" />
        </section>
      </div>
    </div>
  );
}
