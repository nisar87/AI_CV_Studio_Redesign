'use client';

import { AiDocProvider } from '@/features/ai/context';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Eye, Palette, PenLine } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { ButtonLink } from '@/components/ui/button';
import { Tabs, tabId, tabPanelId } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { DocumentPreview, type PreviewStatus } from '@/features/preview/document-preview';
import { StudioBar } from '@/features/studio/studio-bar';
import { ops } from '@/modules/resume/ops';
import type { ResumeDocument } from '@/modules/resume/schema';
import { ContentPanel, type ContentPanelHandle } from './content-panel';
import { DesignPanel } from './design-panel';
import { useDocumentEditor } from './use-document-editor';

type View = 'content' | 'design' | 'preview';

export function PreviewStatusLine({
  status,
  onCompact,
}: {
  status: PreviewStatus | null;
  onCompact?: () => void;
}) {
  if (!status) return <p className="text-ink-muted h-6 text-sm">Preparing preview…</p>;
  return (
    <div
      className="text-ink-muted flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-sm"
      aria-live="polite"
    >
      <span>
        {status.pages} {status.pages === 1 ? 'page' : 'pages'}
      </span>
      {status.nearlyFits && onCompact && (
        <span>
          · Only a little runs onto page 2.{' '}
          <button
            type="button"
            onClick={onCompact}
            className="text-primary font-semibold underline underline-offset-4"
          >
            Fit on one page
          </button>
        </span>
      )}
    </div>
  );
}

export function EditorScreen({ initial }: { initial: ResumeDocument }) {
  const editor = useDocumentEditor(initial);
  const { doc, update } = editor;
  const params = useSearchParams();
  const [welcome, setWelcome] = useState(params.get('welcome') === '1');
  const [view, setView] = useState<View>('content');
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  const content = useRef<ContentPanelHandle>(null);
  const panelTab = view === 'preview' ? 'content' : view;

  const onSelect = (ref: string) => {
    setView('content');
    content.current?.reveal(ref);
  };
  const compact = () => update((d) => ops.setDesign(d, { density: 'compact' }));
  // Links from the CV check open the editor at a field: /cv/:id?focus=<sectionId>/<itemId>.
  const focus = params.get('focus');
  useEffect(() => {
    if (!focus) return;
    const t = window.setTimeout(() => content.current?.reveal(focus), 300);
    return () => window.clearTimeout(t);
  }, [focus]);

  const download = (
    <ButtonLink
      href={`/cv/${doc.id}/download`}
      size="sm"
      className="sm:h-11 sm:px-4"
      icon={<Download aria-hidden size={18} />}
    >
      Download
    </ButtonLink>
  );

  return (
    <AiDocProvider value={doc}>
      <div className="bg-paper flex h-dvh flex-col">
        <StudioBar editor={editor} backHref="/cv" backLabel="Back to My CVs" action={download} />
        <div className="flex min-h-0 flex-1">
          <main
            id="main"
            className={cn(
              'border-line min-h-0 w-full overflow-y-auto pb-24 lg:w-[460px] lg:shrink-0 lg:border-r lg:pb-8',
              view === 'preview' && 'hidden lg:block',
            )}
          >
            <div className="bg-paper/95 sticky top-0 z-10 hidden px-5 pt-3 backdrop-blur lg:block">
              <Tabs
                label="Edit your CV"
                idBase="editor"
                value={panelTab}
                onChange={(v) => setView(v)}
                tabs={[
                  { value: 'content', label: 'Content', icon: <PenLine aria-hidden size={18} /> },
                  { value: 'design', label: 'Design', icon: <Palette aria-hidden size={18} /> },
                ]}
              />
            </div>
            <div
              role="tabpanel"
              id={tabPanelId('editor', panelTab)}
              aria-labelledby={tabId('editor', panelTab)}
              className="px-4 pt-4 sm:px-5"
            >
              {doc.role === 'profile' && (
                <Banner
                  tone="info"
                  title="This is your career profile"
                  className="mb-4"
                  action={
                    <ButtonLink href="/cv" size="sm" variant="secondary">
                      Make a CV from it
                    </ButtonLink>
                  }
                >
                  Keep all your experience here — even things you leave off some CVs. New and
                  tailored CVs are copies of it, so update facts here first.
                </Banner>
              )}
              {welcome && doc.role !== 'profile' && (
                <Banner
                  tone="success"
                  title="Your CV is ready"
                  onDismiss={() => setWelcome(false)}
                  className="mb-4"
                >
                  Check the preview, change anything you like, then download it. Everything saves
                  automatically.
                </Banner>
              )}
              {panelTab === 'content' ? (
                <ContentPanel ref={content} editor={editor} />
              ) : (
                <DesignPanel editor={editor} />
              )}
            </div>
          </main>

          <section
            aria-label="Preview"
            className={cn(
              'bg-sunken min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-24 lg:block lg:px-10 lg:pt-6 lg:pb-10',
              view === 'preview' ? 'block' : 'hidden',
            )}
          >
            <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
              <PreviewStatusLine
                status={status}
                onCompact={doc.design.density !== 'compact' ? compact : undefined}
              />
              <DocumentPreview
                doc={doc}
                onStatus={setStatus}
                onSelect={onSelect}
                title="Preview of your CV. Click any part to edit it."
              />
            </div>
          </section>
        </div>

        <nav
          aria-label="Editor views"
          className="border-line bg-surface fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {(
            [
              ['content', 'Edit', PenLine],
              ['design', 'Design', Palette],
              ['preview', 'Preview', Eye],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-current={view === v ? 'page' : undefined}
              onClick={() => setView(v)}
              className={cn(
                'flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold',
                view === v ? 'text-primary' : 'text-ink-muted',
              )}
            >
              <Icon aria-hidden size={22} />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </AiDocProvider>
  );
}
