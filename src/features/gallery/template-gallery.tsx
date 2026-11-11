'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { DocumentPreview } from '@/features/preview/document-preview';
import { FIXTURES } from '@/modules/resume/fixtures';
import type { ResumeDocument } from '@/modules/resume/schema';
import { TEMPLATE_LIST } from '@/modules/templates/registry';

const SAMPLES = {
  driver: { label: 'Driver', doc: FIXTURES.driver },
  teacher: { label: 'Teacher', doc: FIXTURES.teacher },
  graduate: { label: 'Graduate', doc: FIXTURES.graduate },
  engineer: { label: 'Engineer', doc: FIXTURES.engineer },
} as const;
type SampleId = keyof typeof SAMPLES;

function withTemplate(
  doc: ResumeDocument,
  templateId: ResumeDocument['design']['templateId'],
): ResumeDocument {
  return { ...doc, design: { ...doc.design, templateId } };
}

export function TemplateGallery() {
  const [sample, setSample] = useState<SampleId>('teacher');
  const base = SAMPLES[sample].doc;

  return (
    <div className="flex flex-col gap-8">
      <Segmented
        label="Show an example for"
        value={sample}
        onChange={setSample}
        options={(Object.keys(SAMPLES) as SampleId[]).map((k) => ({
          value: k,
          label: SAMPLES[k].label,
        }))}
        className="max-w-md"
      />
      <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATE_LIST.map((t) => (
          <li key={t.id} className="flex flex-col gap-4">
            <div className="bg-surface shadow-page overflow-hidden rounded-[4px]">
              <DocumentPreview
                doc={withTemplate(base, t.id)}
                firstPageOnly
                debounceMs={0}
                title={`${t.name} design with an example ${SAMPLES[sample].label.toLowerCase()} CV`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">
                {t.name} <span className="text-ink-muted font-normal">· {t.style}</span>
              </h2>
              <p className="text-ink-muted">{t.description}</p>
            </div>
            <ButtonLink
              href={`/start?design=${t.id}`}
              variant="secondary"
              className="self-start"
              iconAfter={<ArrowRight aria-hidden size={16} />}
            >
              Start with {t.name}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
