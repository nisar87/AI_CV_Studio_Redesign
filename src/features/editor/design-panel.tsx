'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { SelectableCard } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/cn';
import { ops } from '@/modules/resume/ops';
import { FONT_PAIR_IDS, type DesignSpec } from '@/modules/resume/schema';
import { contrast } from '@/modules/templates/color';
import { ACCENT_PALETTE } from '@/modules/templates/design';
import { FONT_PAIRS } from '@/modules/templates/fonts';
import { TEMPLATE_LIST, getTemplate } from '@/modules/templates/registry';
import type { DocumentEditor } from './use-document-editor';

const FONT_DESCRIPTIONS: Record<(typeof FONT_PAIR_IDS)[number], string> = {
  modern: 'Clean and contemporary',
  classic: 'Traditional and trustworthy',
  humanist: 'Friendly and warm',
  executive: 'Elegant and refined',
  technical: 'Precise and orderly',
};

function Group({
  title,
  children,
  hint,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h3 id={id} className="text-[17px] font-semibold">
          {title}
        </h3>
        {hint && <p className="text-ink-muted text-sm">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function DesignPanel({ editor }: { editor: DocumentEditor }) {
  const { doc, update } = editor;
  const d = doc.design;
  const set = (patch: Partial<DesignSpec>) => update((x) => ops.setDesign(x, patch));
  const template = getTemplate(d.templateId);
  const customLow = contrast(d.accent, '#ffffff') < 4.5;

  return (
    <div className="flex flex-col gap-8">
      <Group title="Look" hint="Your words stay the same — only the design changes.">
        <div role="radiogroup" aria-label="Design" className="grid gap-3">
          {TEMPLATE_LIST.map((t) => (
            <SelectableCard
              key={t.id}
              role="radio"
              aria-checked={d.templateId === t.id}
              selected={d.templateId === t.id}
              onClick={() => set({ templateId: t.id })}
            >
              <span className="font-semibold">
                {t.style} <span className="text-ink-muted font-normal">· {t.name}</span>
              </span>
              <span className="text-ink-muted pr-8 text-sm">{t.description}</span>
            </SelectableCard>
          ))}
        </div>
      </Group>

      <Group title="Colour">
        <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2">
          {ACCENT_PALETTE.map((c) => {
            const selected = d.accent.toLowerCase() === c.hex;
            return (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c.name}
                title={c.name}
                onClick={() => set({ accent: c.hex })}
                className={cn(
                  'inline-flex size-11 items-center justify-center rounded-full border-2 transition-transform hover:scale-105',
                  selected ? 'border-ink' : 'border-transparent',
                )}
              >
                <span
                  className="inline-flex size-8 items-center justify-center rounded-full text-white"
                  style={{ background: c.hex }}
                >
                  {selected && <Check aria-hidden size={16} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
          <label className="border-line-strong bg-surface hover:bg-sunken inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border pr-4 pl-1.5 text-sm font-semibold">
            <input
              type="color"
              value={d.accent}
              onChange={(e) =>
                update((x) => ops.setDesign(x, { accent: e.target.value }), 'design.accent')
              }
              className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Choose any colour"
            />
            Other
          </label>
        </div>
        {customLow && (
          <p className="text-ink-muted text-sm">
            This colour is quite light, so we use a slightly darker shade for text to keep it
            readable.
          </p>
        )}
      </Group>

      <Group title="Font">
        <div role="radiogroup" aria-label="Font" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FONT_PAIR_IDS.map((id) => (
            <SelectableCard
              key={id}
              role="radio"
              aria-checked={d.fontPair === id}
              selected={d.fontPair === id}
              onClick={() => set({ fontPair: id })}
              className="p-3"
            >
              <span className="font-semibold">{FONT_PAIRS[id].label}</span>
              <span className="text-ink-muted pr-6 text-sm">{FONT_DESCRIPTIONS[id]}</span>
            </SelectableCard>
          ))}
        </div>
      </Group>

      <Group title="Layout">
        <Segmented
          label="Spacing"
          value={d.density}
          onChange={(density) => set({ density })}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'airy', label: 'Airy' },
          ]}
        />
        <Segmented
          label="Paper size"
          value={d.pageSize}
          onChange={(pageSize) => set({ pageSize })}
          options={[
            { value: 'A4', label: 'A4 (most countries)' },
            { value: 'Letter', label: 'Letter (US, Canada)' },
          ]}
        />
        {template.support.headerAlign.length > 1 && (
          <Segmented
            label="Name position"
            value={d.options.headerAlign ?? template.support.defaults.headerAlign}
            onChange={(headerAlign) => set({ options: { headerAlign } })}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Centre' },
            ]}
          />
        )}
        {template.support.skillStyle.length > 1 && (
          <Segmented
            label="Skills shown as"
            value={d.options.skillStyle ?? template.support.defaults.skillStyle}
            onChange={(skillStyle) => set({ options: { skillStyle } })}
            options={[
              { value: 'inline', label: 'A list' },
              { value: 'tags', label: 'Labels' },
            ]}
          />
        )}
      </Group>
    </div>
  );
}
