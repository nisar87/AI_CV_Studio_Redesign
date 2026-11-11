'use client';

import { TextField } from '@/components/ui/field';
import type { Preset } from '@/modules/resume/presets';
import type { Section, SectionKind } from '@/modules/resume/schema';
import { BulletsAssist, SkillsAssist } from '@/features/ai/assist';
import { NeedsInputHint } from '@/features/ai/suggestion';
import { CheckboxField, DateField, LinesField, TagsField } from './fields';
import { KIND_INFO } from './item-fields';

type Item = Section['items'][number];

/** Sections whose bullet points AI can help write. */
const AI_BULLET_KINDS = new Set<SectionKind>(['experience', 'volunteering', 'projects', 'custom']);

type Props = {
  kind: SectionKind;
  item: Item;
  preset: Preset;
  onChange: (patch: Record<string, unknown>, key: string) => void;
};

/** Renders the plain-language form for one item, driven by KIND_INFO. */
export function ItemForm({ kind, item, preset, onChange }: Props) {
  const values = item as unknown as Record<string, unknown>;
  const current = Boolean(values.current);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      {KIND_INFO[kind].fields.map((f) => {
        const key = `${item.id}.${f.key}`;
        const span = 'half' in f && f.half ? 'col-span-2 sm:col-span-1' : 'col-span-2';
        switch (f.type) {
          case 'text':
            return (
              <TextField
                key={f.key}
                containerClassName={span}
                label={f.label}
                hint={f.hint}
                placeholder={f.placeholder?.(preset)}
                value={String(values[f.key] ?? '')}
                onChange={(e) => onChange({ [f.key]: e.target.value }, key)}
              />
            );
          case 'date':
            return (
              <DateField
                key={f.key}
                className={span}
                label={f.label}
                value={String(values[f.key] ?? '')}
                disabled={f.key === 'end' && current}
                onChange={(v) => onChange({ [f.key]: v }, key)}
              />
            );
          case 'current':
            return (
              <div key={f.key} className="col-span-2 -mt-2">
                <CheckboxField
                  label={f.label}
                  checked={current}
                  onChange={(v) => onChange({ current: v, ...(v ? { end: '' } : {}) }, key)}
                />
              </div>
            );
          case 'lines': {
            const lines = (values[f.key] as string[]) ?? [];
            return (
              <div key={f.key} className="col-span-2 flex flex-col gap-1.5">
                <LinesField
                  label={f.label}
                  hint={f.hint}
                  placeholder={f.placeholder?.(preset)}
                  value={lines}
                  onChange={(v) => onChange({ [f.key]: v }, key)}
                />
                <NeedsInputHint texts={lines} />
                {AI_BULLET_KINDS.has(kind) && (
                  <BulletsAssist
                    presetId={preset.id}
                    role={String(values.role ?? values.name ?? values.title ?? '')}
                    organization={String(values.organization ?? values.subtitle ?? '')}
                    bullets={lines}
                    onApply={(v) => onChange({ [f.key]: v }, `${key}.ai.${Date.now()}`)}
                  />
                )}
              </div>
            );
          }
          case 'tags':
            return (
              <div key={f.key} className="col-span-2 flex flex-col gap-2">
                <TagsField
                  label={f.label}
                  hint={f.hint}
                  value={(values[f.key] as string[]) ?? []}
                  suggestions={preset.suggestedSkills}
                  onChange={(v) => onChange({ [f.key]: v }, key)}
                />
                {kind === 'skills' && (
                  <SkillsAssist
                    existing={(values[f.key] as string[]) ?? []}
                    onAdd={(add) =>
                      onChange(
                        { [f.key]: [...((values[f.key] as string[]) ?? []), ...add] },
                        `${key}.ai.${Date.now()}`,
                      )
                    }
                  />
                )}
              </div>
            );
        }
      })}
    </div>
  );
}

/** One-line summary for a collapsed item. */
export function itemSummary(kind: SectionKind, item: Item): { title: string; subtitle: string } {
  const [a, b] = KIND_INFO[kind].summary;
  const v = item as unknown as Record<string, unknown>;
  const show = (x: unknown) =>
    (Array.isArray(x) ? x.filter(Boolean).join(', ') : String(x ?? '')).trim();
  const title = show(v[a]) || show(v[b]);
  return { title: title || `New ${KIND_INFO[kind].noun}`, subtitle: show(v[a]) ? show(v[b]) : '' };
}
