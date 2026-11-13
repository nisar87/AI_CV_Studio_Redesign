'use client';

import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { getRepository } from '@/modules/storage/repository';
import { CREATE, DESTINATIONS } from './destinations';

type Entry = { label: string; group: string; href: string };

/** Ctrl/Cmd+K: jump to any destination, start anything, or open a document by name. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const id = useId();
  const all = useMemo<Entry[]>(() => {
    if (!open) return [];
    const docs =
      typeof window === 'undefined'
        ? []
        : getRepository()
            .list()
            .map((d) => ({
              label: d.title || d.name || 'Untitled CV',
              group: 'Documents',
              href: `/cv/${d.id}`,
            }));
    return [
      ...DESTINATIONS.map((d) => ({ label: d.label, group: 'Go to', href: d.href })),
      ...CREATE.map((c) => ({ label: c.label, group: 'Create', href: c.href })),
      { label: 'Designs', group: 'Go to', href: '/templates' },
      { label: 'Career profile', group: 'Go to', href: '/profile' },
      { label: 'Story bank', group: 'Go to', href: '/stories' },
      { label: 'Account and settings', group: 'Go to', href: '/account' },
      { label: 'Help', group: 'Go to', href: '/help' },
      ...docs,
    ];
  }, [open]);
  const shown = all
    .filter((e) => e.label.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 12);
  const go = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    setQ('');
    router.push(e.href);
  };
  return (
    <Dialog open={open} onClose={onClose} title="Search or jump to" hideTitle>
      <input
        data-autofocus
        role="combobox"
        aria-expanded
        aria-controls={`${id}-list`}
        aria-activedescendant={shown[sel] ? `${id}-${sel}` : undefined}
        aria-label="Search or jump to"
        placeholder="Search documents, pages and actions…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel((s) => Math.min(shown.length - 1, s + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((s) => Math.max(0, s - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            go(shown[sel]);
          }
        }}
        className="border-line-strong bg-surface focus-visible:border-primary h-12 w-full rounded-md border px-3 text-base focus-visible:outline-none"
      />
      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label="Results"
        className="flex max-h-80 flex-col overflow-y-auto"
      >
        {shown.map((e, i) => (
          <li
            key={`${e.group}-${e.href}-${e.label}`}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === sel}
            onMouseEnter={() => setSel(i)}
            onClick={() => go(e)}
            className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 ${i === sel ? 'bg-primary-soft' : ''}`}
          >
            <span className="font-semibold">{e.label}</span>
            <span className="text-ink-muted text-xs">{e.group}</span>
          </li>
        ))}
        {shown.length === 0 && <li className="text-ink-muted px-3 py-2">Nothing matches “{q}”.</li>}
      </ul>
    </Dialog>
  );
}
