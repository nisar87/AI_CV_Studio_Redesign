'use client';

import { useState } from 'react';
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
          case 'select':
            return (
              <label key={f.key} className={`${span} flex flex-col gap-1.5 text-sm font-semibold`}>
                {f.label}
                <select
                  className="border-line-strong bg-surface min-h-11 rounded-md border px-3 text-[15px] font-normal"
                  value={String(values[f.key] ?? '')}
                  onChange={(e) => onChange({ [f.key]: e.target.value || undefined }, key)}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {f.hint && <span className="text-ink-muted font-normal">{f.hint}</span>}
              </label>
            );
          case 'tags': {
            const tags = (values[f.key] as string[]) ?? [];
            const levels = (values.levels as number[] | undefined) ?? [];
            // Levels follow their keyword when keywords are added, removed or reordered.
            const setTags = (v: string[]) => {
              if (!f.levels || !levels.some((l) => l > 0)) return onChange({ [f.key]: v }, key);
              const by = new Map(tags.map((t, i) => [t, levels[i] ?? 0]));
              onChange({ [f.key]: v, levels: v.map((t) => by.get(t) ?? 0) }, key);
            };
            return (
              <div key={f.key} className="col-span-2 flex flex-col gap-2">
                <TagsField
                  label={f.label}
                  hint={f.hint}
                  value={tags}
                  suggestions={preset.suggestedSkills}
                  onChange={setTags}
                />
                {f.levels && tags.length > 0 && (
                  <SkillLevels
                    tags={tags}
                    levels={levels}
                    onChange={(l) => onChange({ levels: l }, `${key}.levels`)}
                  />
                )}
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
        }
      })}
    </div>
  );
}

/** Optional 1–5 level per skill: lets designs show bars or dots honestly. */
function SkillLevels({
  tags,
  levels,
  onChange,
}: {
  tags: string[];
  levels: number[];
  onChange: (levels: number[] | undefined) => void;
}) {
  const on = levels.some((l) => l > 0);
  const [open, setOpen] = useState(on);
  return (
    <div className="flex flex-col gap-2">
      <CheckboxField
        label="Show a level for each skill (for bar or dot designs)"
        checked={open}
        onChange={(v) => {
          setOpen(v);
          if (!v) onChange(undefined);
        }}
      />
      {open && (
        <ul className="flex flex-col gap-1.5" aria-label="Skill levels">
          {tags.map((t, i) => (
            <li key={`${t}-${i}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{t}</span>
              <select
                aria-label={`Level for ${t}`}
                className="border-line-strong bg-surface min-h-10 rounded-md border px-2"
                value={levels[i] ?? 0}
                onChange={(e) => {
                  const next = tags.map((_, j) => levels[j] ?? 0);
                  next[i] = Number(e.target.value);
                  onChange(next);
                }}
              >
                <option value={0}>Not set</option>
                <option value={1}>1 — Beginner</option>
                <option value={2}>2</option>
                <option value={3}>3 — Good</option>
                <option value={4}>4</option>
                <option value={5}>5 — Expert</option>
              </select>
            </li>
          ))}
        </ul>
      )}
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
