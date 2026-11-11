'use client';

import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/icon-button';
import { Menu } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { ops } from '@/modules/resume/ops';
import type { Preset } from '@/modules/resume/presets';
import type { ResumeDocument, Section } from '@/modules/resume/schema';
import { ItemForm, itemSummary } from './item-form';
import { KIND_INFO } from './item-fields';
import type { DocumentEditor } from './use-document-editor';

type Props = {
  editor: DocumentEditor;
  section: Section;
  index: number;
  count: number;
  preset: Preset;
  expanded: Set<string>;
  toggle: (itemId: string, open?: boolean) => void;
};

export function SectionCard({ editor, section, index, count, preset, expanded, toggle }: Props) {
  const { update } = editor;
  const toast = useToast();
  const info = KIND_INFO[section.kind];
  const [renaming, setRenaming] = useState(false);
  const titleId = `section-${section.id}-title`;

  const removeSection = () => {
    let removed: { doc: ResumeDocument } | null = null;
    update((d) => {
      removed = { doc: d };
      return ops.removeSection(d, section.id);
    });
    toast.show({
      message: `“${section.title}” removed`,
      action: { label: 'Undo', onAction: () => removed && editor.undo() },
    });
  };

  const removeItem = (itemId: string, label: string) => {
    update((d) => ops.removeItem(d, section.id, itemId));
    toast.show({
      message: `${label} removed`,
      action: { label: 'Undo', onAction: () => editor.undo() },
    });
  };

  return (
    <section
      aria-labelledby={titleId}
      data-section={section.id}
      className={cn(
        'border-line bg-surface shadow-1 rounded-lg border',
        section.hidden && 'opacity-70',
      )}
    >
      <header className="border-line flex items-center gap-1 border-b py-1 pr-1 pl-4">
        {renaming ? (
          <input
            autoFocus
            aria-label="Section name"
            defaultValue={section.title}
            className="border-primary h-10 min-w-0 flex-1 rounded-sm border px-2 text-[17px] font-semibold focus-visible:outline-none"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== section.title) update((d) => ops.renameSection(d, section.id, v));
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <h3 id={titleId} className="min-w-0 flex-1 truncate text-[17px] font-semibold">
            {section.title}
            {section.hidden && (
              <span className="text-ink-muted ml-2 text-sm font-normal">(hidden from CV)</span>
            )}
          </h3>
        )}
        <IconButton
          label={`Move “${section.title}” up`}
          icon={<ArrowUp aria-hidden size={18} />}
          disabled={index === 0}
          onClick={() => update((d) => ops.moveSection(d, section.id, -1))}
        />
        <IconButton
          label={`Move “${section.title}” down`}
          icon={<ArrowDown aria-hidden size={18} />}
          disabled={index === count - 1}
          onClick={() => update((d) => ops.moveSection(d, section.id, 1))}
        />
        <Menu
          label={`More options for “${section.title}”`}
          items={[
            {
              label: 'Rename section',
              icon: <Pencil aria-hidden size={16} />,
              onSelect: () => setRenaming(true),
            },
            section.hidden
              ? {
                  label: 'Show on CV',
                  icon: <Eye aria-hidden size={16} />,
                  onSelect: () => update((d) => ops.setSectionHidden(d, section.id, false)),
                }
              : {
                  label: 'Hide from CV',
                  icon: <EyeOff aria-hidden size={16} />,
                  onSelect: () => update((d) => ops.setSectionHidden(d, section.id, true)),
                },
            {
              label: 'Remove section',
              icon: <Trash2 aria-hidden size={16} />,
              danger: true,
              onSelect: removeSection,
            },
          ]}
        />
      </header>

      <ul className="flex flex-col">
        {section.items.map((item, i) => {
          const open = expanded.has(item.id);
          const { title, subtitle } = itemSummary(section.kind, item);
          return (
            <li
              key={item.id}
              id={`item-${item.id}`}
              className="border-line border-b last:border-b-0"
            >
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`item-body-${item.id}`}
                  onClick={() => toggle(item.id)}
                  className="hover:bg-sunken/60 flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left"
                >
                  <ChevronDown
                    aria-hidden
                    size={18}
                    className={cn(
                      'text-ink-subtle shrink-0 transition-transform',
                      open && 'rotate-180',
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{title}</span>
                    {subtitle && (
                      <span className="text-ink-muted truncate text-sm">{subtitle}</span>
                    )}
                  </span>
                </button>
                {section.items.length > 1 && (
                  <>
                    <IconButton
                      size="sm"
                      label={`Move ${title} up`}
                      icon={<ArrowUp aria-hidden size={16} />}
                      disabled={i === 0}
                      onClick={() => update((d) => ops.moveItem(d, section.id, item.id, -1))}
                    />
                    <IconButton
                      size="sm"
                      label={`Move ${title} down`}
                      icon={<ArrowDown aria-hidden size={16} />}
                      disabled={i === section.items.length - 1}
                      onClick={() => update((d) => ops.moveItem(d, section.id, item.id, 1))}
                    />
                  </>
                )}
                <IconButton
                  size="sm"
                  label={`Remove ${title}`}
                  icon={<Trash2 aria-hidden size={16} />}
                  onClick={() => removeItem(item.id, title)}
                />
              </div>
              {open && (
                <div id={`item-body-${item.id}`} className="px-4 pt-2 pb-5">
                  <ItemForm
                    kind={section.kind}
                    item={item}
                    preset={preset}
                    onChange={(patch, key) =>
                      update((d) => ops.updateItem(d, section.id, item.id, patch), key)
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="p-2">
        <button
          type="button"
          onClick={() => {
            let newId = '';
            update((d) => {
              const r = ops.addItem(d, section.id);
              newId = r.itemId;
              return r.doc;
            });
            if (newId) toggle(newId, true);
          }}
          className="text-primary hover:bg-primary-soft inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-[15px] font-semibold"
        >
          <Plus aria-hidden size={18} />
          Add {section.items.length ? 'another' : 'a'} {info.noun}
        </button>
      </div>
    </section>
  );
}
