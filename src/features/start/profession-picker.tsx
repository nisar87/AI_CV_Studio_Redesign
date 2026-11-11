'use client';

import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PROFESSIONS, type PresetId } from '@/modules/resume/professions';
import { ProfessionIcon } from './profession-icon';

type Props = {
  /** Called when a profession is chosen. */
  onChoose: (id: PresetId) => void;
  busy?: PresetId | null;
};

export function ProfessionPicker({ onChoose, busy }: Props) {
  const params = useSearchParams();
  const highlighted = params.get('work');

  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Kinds of work">
      {PROFESSIONS.map((p) => {
        const isHighlighted = highlighted === p.id;
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onChoose(p.id)}
              disabled={Boolean(busy)}
              aria-busy={busy === p.id || undefined}
              className={cn(
                'group bg-surface shadow-1 flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-[border-color,box-shadow,background-color] duration-150',
                'hover:border-primary hover:shadow-2 disabled:cursor-wait',
                isHighlighted ? 'border-primary bg-primary-soft border-2' : 'border-line',
              )}
            >
              <span className="bg-primary-soft text-primary group-hover:bg-primary group-hover:text-on-primary inline-flex size-12 shrink-0 items-center justify-center rounded-md">
                <ProfessionIcon id={p.id} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-ink text-[17px] font-semibold">{p.name}</span>
                <span className="text-ink-muted text-sm">{p.example}</span>
              </span>
              <ChevronRight
                aria-hidden
                size={20}
                className="text-ink-subtle group-hover:text-primary shrink-0"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
