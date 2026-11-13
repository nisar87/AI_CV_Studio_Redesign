'use client';

import { AiDocProvider } from '@/features/ai/context';
import { SummaryAssist } from '@/features/ai/assist';
import { NeedsInputHint } from '@/features/ai/suggestion';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Stepper } from '@/components/ui/misc';
import { BasicsForm } from '@/features/editor/basics-form';
import { TagsField } from '@/features/editor/fields';
import { ItemForm, itemSummary } from '@/features/editor/item-form';
import { KIND_INFO } from '@/features/editor/item-fields';
import { useDocumentEditor } from '@/features/editor/use-document-editor';
import { DocumentPreview } from '@/features/preview/document-preview';
import { StudioBar } from '@/features/studio/studio-bar';
import { getPreset } from '@/modules/resume/presets';
import { ops } from '@/modules/resume/ops';
import type { ResumeDocument, Section } from '@/modules/resume/schema';

type Step = { kind: 'about' } | { kind: 'section'; sectionId: string } | { kind: 'summary' };

function SectionStep({
  editor,
  section,
}: {
  editor: ReturnType<typeof useDocumentEditor>;
  section: Section;
}) {
  const { doc, update } = editor;
  const preset = getPreset(doc.presetId);
  const info = KIND_INFO[section.kind];

  if (section.kind === 'skills') {
    const group = section.items[0];
    return (
      <TagsField
        label="Your skills"
        hint="Type a skill and press Enter, or tap the suggestions that fit you."
        value={group && 'keywords' in group ? group.keywords : []}
        suggestions={preset.suggestedSkills}
        onChange={(keywords) =>
          update((d) => {
            const s = d.sections.find((x) => x.id === section.id)!;
            if (s.items[0]) return ops.updateItem(d, section.id, s.items[0].id, { keywords });
            const r = ops.addItem(d, section.id);
            return ops.updateItem(r.doc, section.id, r.itemId, { keywords });
          }, `${section.id}.skills`)
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {section.items.map((item, i) => (
        <fieldset
          key={item.id}
          className="border-line bg-surface shadow-1 rounded-lg border p-4 sm:p-5"
        >
          <legend className="sr-only">{itemSummary(section.kind, item).title}</legend>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-ink-muted text-sm font-semibold">
              {info.noun.charAt(0).toUpperCase() + info.noun.slice(1)} {i + 1}
            </p>
            <IconButton
              size="sm"
              label={`Remove ${info.noun} ${i + 1}`}
              icon={<Trash2 aria-hidden size={16} />}
              onClick={() => update((d) => ops.removeItem(d, section.id, item.id))}
            />
          </div>
          <ItemForm
            kind={section.kind}
            item={item}
            preset={preset}
            onChange={(patch, key) =>
              update((d) => ops.updateItem(d, section.id, item.id, patch), key)
            }
          />
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() => update((d) => ops.addItem(d, section.id).doc)}
        className="border-line-strong bg-surface text-primary hover:border-primary hover:bg-primary-soft inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-dashed font-semibold"
      >
        <Plus aria-hidden size={18} /> Add {section.items.length ? 'another' : 'a'} {info.noun}
      </button>
    </div>
  );
}

export function GuidedScreen({ initial }: { initial: ResumeDocument }) {
  const editor = useDocumentEditor(initial);
  const { doc, update } = editor;
  const router = useRouter();
  const preset = getPreset(doc.presetId);
  const [index, setIndex] = useState(0);
  const [nameError, setNameError] = useState(false);
  const [peek, setPeek] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Steps follow the CV's own sections (as created from the profession preset).
  const sectionIds = doc.sections.map((s) => s.id).join(',');
  const steps: Step[] = useMemo(
    () => [
      { kind: 'about' },
      ...sectionIds
        .split(',')
        .filter(Boolean)
        .map((sectionId) => ({ kind: 'section' as const, sectionId })),
      { kind: 'summary' },
    ],
    [sectionIds],
  );
  const step = steps[Math.min(index, steps.length - 1)]!;
  const section =
    step.kind === 'section' ? doc.sections.find((s) => s.id === step.sectionId) : undefined;

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [index]);

  // Make sure a section step starts with one empty entry to fill in.
  useEffect(() => {
    if (section && section.items.length === 0 && section.kind !== 'skills')
      update((d) => ops.addItem(d, section.id).doc);
  }, [section, update]);

  const title =
    step.kind === 'about'
      ? 'About you'
      : step.kind === 'summary'
        ? 'Introduce yourself'
        : KIND_INFO[section!.kind].question;
  const label =
    step.kind === 'about' ? 'About you' : step.kind === 'summary' ? 'Introduction' : section!.title;
  const intro =
    step.kind === 'about'
      ? 'Start with how employers can reach you.'
      : step.kind === 'summary'
        ? 'Two or three sentences at the top of your CV. You can skip this and add it later.'
        : 'Fill in what you can. Anything you leave empty will not appear on your CV.';

  const next = () => {
    if (step.kind === 'about' && !doc.basics.name.trim()) {
      setNameError(true);
      document.querySelector<HTMLInputElement>('[data-field="basics.name"]')?.focus();
      return;
    }
    setNameError(false);
    if (index >= steps.length - 1) {
      editor.flush();
      router.push(`/cv/${doc.id}?welcome=1`);
    } else setIndex(index + 1);
  };

  return (
    <AiDocProvider value={doc}>
      <div className="bg-paper flex min-h-dvh flex-col">
        <StudioBar editor={editor} backHref="/documents" backLabel="Save and go to Documents" />
        <div className="flex flex-1">
          <main
            id="main"
            className="mx-auto w-full max-w-[640px] px-4 pt-6 pb-32 sm:px-6 lg:mx-0 lg:max-w-none lg:flex-1 lg:px-12 xl:px-20"
          >
            <div className="mx-auto flex max-w-[600px] flex-col gap-6">
              <Stepper current={index + 1} total={steps.length} label={label} />
              <div className="flex flex-col gap-2">
                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="font-display text-[28px] leading-tight font-semibold tracking-tight focus:outline-none sm:text-[32px]"
                >
                  {title}
                </h1>
                <p className="text-ink-muted">{intro}</p>
              </div>

              {step.kind === 'about' && (
                <div className="flex flex-col gap-2">
                  <BasicsForm
                    editor={editor}
                    showLinks={
                      preset.id === 'tech' || preset.id === 'student' || preset.id === 'executive'
                    }
                  />
                  {nameError && (
                    <p role="alert" className="text-danger text-sm font-semibold">
                      Please add your name so we can put it at the top of your CV.
                    </p>
                  )}
                </div>
              )}
              {section && <SectionStep editor={editor} section={section} />}
              {step.kind === 'summary' && (
                <div className="flex flex-col gap-2">
                  <TextArea
                    label="Your introduction"
                    rows={5}
                    placeholder={preset.hints.summary}
                    hint="Say what you do, how long you have done it, and what you are looking for."
                    value={doc.basics.summary}
                    onChange={(e) =>
                      update(
                        (d) => ops.updateBasics(d, { summary: e.target.value }),
                        'basics.summary',
                      )
                    }
                  />
                  <NeedsInputHint texts={[doc.basics.summary]} />
                  <SummaryAssist
                    summary={doc.basics.summary}
                    onApply={(text) =>
                      update(
                        (d) => ops.updateBasics(d, { summary: text }),
                        `basics.summary.ai.${Date.now()}`,
                      )
                    }
                  />
                </div>
              )}
            </div>
          </main>
          <aside
            aria-label="Preview"
            className="border-line bg-sunken hidden w-[min(44vw,620px)] shrink-0 border-l p-8 lg:block"
          >
            <div className="sticky top-8">
              <DocumentPreview doc={doc} title="Preview of your CV" />
            </div>
          </aside>
        </div>

        <div className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:right-[min(44vw,620px)]">
          <div className="mx-auto flex max-w-[600px] items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              icon={<ArrowLeft aria-hidden size={18} />}
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              className="lg:hidden"
              icon={<Eye aria-hidden size={18} />}
              onClick={() => setPeek(true)}
            >
              Peek
            </Button>
            <Button
              className="ml-auto"
              onClick={next}
              iconAfter={<ArrowRight aria-hidden size={18} />}
            >
              {index >= steps.length - 1 ? 'Finish' : 'Continue'}
            </Button>
          </div>
        </div>

        {peek && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Preview of your CV"
            className="bg-sunken fixed inset-0 z-40 flex flex-col lg:hidden"
          >
            <div className="border-line bg-surface flex h-14 items-center justify-between border-b px-4">
              <p className="font-semibold">Your CV so far</p>
              <IconButton
                autoFocus
                label="Close preview"
                icon={<X aria-hidden size={20} />}
                onClick={() => setPeek(false)}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <DocumentPreview doc={doc} title="Preview of your CV" />
            </div>
          </div>
        )}
      </div>
    </AiDocProvider>
  );
}
