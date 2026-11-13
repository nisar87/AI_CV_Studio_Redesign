'use client';

import { tierDesignId } from '@/modules/design/catalogue';
import { DESIGN_META } from '@/modules/design/designs';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Crown, Download, FileJson, FileText, LogIn, Printer } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { useAccount } from '@/features/account/account-context';
import { isPremiumDesign, remaining, useEntitlements } from '@/features/account/entitlements';
import { ops } from '@/modules/resume/ops';
import { getRepository } from '@/modules/storage/repository';
import { useToast } from '@/components/ui/toast';
import { DocumentPreview, type PreviewStatus } from '@/features/preview/document-preview';
import { PreviewStatusLine } from '@/features/editor/editor-screen';
import { pdfFilename } from '@/modules/export/filename';
import type { ResumeDocument } from '@/modules/resume/schema';
import { buildDocumentHtml } from '@/modules/templates/build-document';
import { HealthPanel } from '@/features/quality/health-panel';
import { saveBlob } from '@/lib/save-blob';
import { SharePanel } from '@/features/share/share-panel';

type Blocked = {
  code: 'SIGN_IN_REQUIRED' | 'PREMIUM_REQUIRED' | 'LIMIT_REACHED' | 'DISABLED';
  message: string;
};

export function DownloadScreen({ doc: initialDoc }: { doc: ResumeDocument }) {
  const toast = useToast();
  const account = useAccount();
  const { ent, refresh } = useEntitlements();
  const [doc, setDoc] = useState(initialDoc);
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyWord, setBusyWord] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const editHref = `/cv/${doc.id}`;
  const here = `/cv/${doc.id}/download`;
  const signedOut = account.status === 'signedOut';
  const designId = tierDesignId(doc.design);
  const customDesign = designId === null;
  const lockedDesign = ent
    ? ent.plan !== 'premium' && (customDesign || isPremiumDesign(ent, designId))
    : false;
  const left = ent && ent.plan !== 'visitor' ? remaining(ent, 'pdf.download') : null;

  /** Switch to the first free design (keeps all content), from the locked-design card. */
  function switchToFreeDesign() {
    const free = ent?.designs.find((d) => d.enabled && d.tier === 'free');
    if (!free) return;
    const next = ops.useDesign(doc, free.id);
    getRepository().save(next);
    setDoc(next);
    setBlocked(null);
    toast.show({
      message: `Switched to ${DESIGN_META[free.id].name}. Your words are unchanged.`,
      tone: 'success',
    });
  }

  const downloadPdf = () => download('pdf');
  async function download(kind: 'pdf' | 'docx') {
    const setB = kind === 'pdf' ? setBusy : setBusyWord;
    setB(true);
    setFailed(null);
    try {
      const res = await fetch(kind === 'pdf' ? '/api/pdf' : '/api/docx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: doc }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        const code = body?.error?.code;
        if (
          code === 'SIGN_IN_REQUIRED' ||
          code === 'PREMIUM_REQUIRED' ||
          code === 'LIMIT_REACHED' ||
          code === 'DISABLED'
        ) {
          setBlocked({ code, message: body?.error?.message ?? '' });
          refresh();
          return;
        }
        throw new Error(body?.error?.message ?? 'We couldn’t create the file just now.');
      }
      const name = pdfFilename(doc.basics.name);
      saveBlob(await res.blob(), kind === 'pdf' ? name : name.replace(/\.pdf$/, '.docx'));
      toast.show({
        message: kind === 'pdf' ? 'Your PDF is downloading' : 'Your Word file is downloading',
        tone: 'success',
      });
      refresh();
    } catch (e) {
      setFailed(
        e instanceof Error && e.message !== 'Failed to fetch'
          ? e.message
          : 'You seem to be offline, or our PDF service is busy.',
      );
    } finally {
      setB(false);
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

          <HealthPanel doc={doc} pages={status?.pages} />

          {failed && (
            <Banner
              tone="error"
              title="We couldn’t create the PDF"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={downloadPdf}>
                    Try again
                  </Button>
                  {!signedOut && !lockedDesign && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Printer aria-hidden size={16} />}
                      onClick={print}
                    >
                      Print or save as PDF
                    </Button>
                  )}
                </div>
              }
            >
              {failed}{' '}
              {!signedOut &&
                !lockedDesign &&
                'You can also use your browser’s print window and choose “Save as PDF”.'}
            </Banner>
          )}

          {(blocked?.code === 'PREMIUM_REQUIRED' || lockedDesign) && (
            <section
              aria-labelledby="premium-h"
              data-gate="premium-design"
              className="border-accent/40 bg-accent-soft flex flex-col gap-3 rounded-lg border p-5"
            >
              <h2 id="premium-h" className="flex items-center gap-2 text-lg font-semibold">
                <Crown aria-hidden size={20} className="text-accent-ink" />{' '}
                {designId === null
                  ? 'Custom designs are part of Premium'
                  : `${DESIGN_META[designId].name} is a Premium design`}
              </h2>
              <p className="text-ink-muted">
                Premium unlocks every design, AI writing help and more downloads. Or switch to a
                free design — your words stay exactly the same.
              </p>
              <div className="flex flex-wrap gap-2">
                {ent?.features.sales && (
                  <ButtonLink
                    href={`/premium?next=${encodeURIComponent(here)}`}
                    icon={<Crown aria-hidden size={18} />}
                  >
                    See Premium
                  </ButtonLink>
                )}
                <Button variant="secondary" onClick={switchToFreeDesign}>
                  Use a free design instead
                </Button>
              </div>
            </section>
          )}

          {blocked?.code === 'LIMIT_REACHED' && (
            <Banner
              tone="warning"
              title="Monthly download limit reached"
              action={
                ent?.features.sales ? (
                  <ButtonLink
                    size="sm"
                    href={`/premium?next=${encodeURIComponent(here)}`}
                    icon={<Crown aria-hidden size={16} />}
                  >
                    See Premium
                  </ButtonLink>
                ) : undefined
              }
            >
              {blocked.message}
            </Banner>
          )}
          {blocked?.code === 'DISABLED' && <Banner tone="warning">{blocked.message}</Banner>}

          <div className="flex flex-col gap-3">
            {signedOut || blocked?.code === 'SIGN_IN_REQUIRED' ? (
              <>
                <ButtonLink
                  size="lg"
                  href={`/signin?next=${encodeURIComponent(here)}`}
                  icon={<LogIn aria-hidden size={20} />}
                >
                  Sign in to download
                </ButtonLink>
                <p className="text-ink-muted text-sm">
                  A free account saves your CV safely and lets you download it as a PDF. It takes
                  under a minute.
                </p>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  icon={<Download aria-hidden size={20} />}
                  loading={busy}
                  loadingText="Preparing your PDF…"
                  disabled={lockedDesign || account.status === 'loading'}
                  onClick={downloadPdf}
                >
                  Download PDF
                </Button>
                <Button
                  variant="secondary"
                  icon={<FileText aria-hidden size={18} />}
                  loading={busyWord}
                  loadingText="Preparing your Word file…"
                  disabled={account.status === 'loading' || busy}
                  onClick={() => download('docx')}
                >
                  Download Word (.docx)
                </Button>
                {left !== null && Number.isFinite(left) && (
                  <p className="text-ink-muted text-sm" data-testid="downloads-left">
                    {left} of {ent!.limits['pdf.download']} downloads left this month.
                  </p>
                )}
              </>
            )}
            <Button variant="secondary" icon={<FileJson aria-hidden size={18} />} onClick={backup}>
              Save a backup file
            </Button>
            <p className="text-ink-muted text-sm">
              A backup file lets you open this CV in another browser, even without an account.
            </p>
          </div>
          {account.status === 'signedIn' && <SharePanel docId={doc.id} />}
          {account.status === 'signedIn' && (
            <Link
              href={`/linkedin?doc=${encodeURIComponent(doc.id)}`}
              className="text-primary inline-flex items-center gap-1.5 font-semibold"
            >
              Update your LinkedIn profile from this CV →
            </Link>
          )}
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
