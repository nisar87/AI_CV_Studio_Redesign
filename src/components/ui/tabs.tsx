'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tab<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

type TabsProps<T extends string> = {
  label: string;
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Ids used to connect tabs with their panels (`${idBase}-panel-${value}`). */
  idBase?: string;
};

export function tabPanelId(idBase: string, value: string) {
  return `${idBase}-panel-${value}`;
}
export function tabId(idBase: string, value: string) {
  return `${idBase}-tab-${value}`;
}

/** WAI-ARIA tabs (automatic activation). Render panels with `role="tabpanel"` using tabPanelId/tabId. */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  className,
  idBase,
}: TabsProps<T>) {
  const fallback = useId();
  const base = idBase ?? fallback;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, i: number) {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const t = tabs[next];
    if (t) {
      onChange(t.value);
      refs.current[next]?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('border-line flex gap-1 border-b', className)}
    >
      {tabs.map((t, i) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(base, t.value)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={tabPanelId(base, t.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              '-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-[15px] font-semibold transition-colors duration-150',
              selected
                ? 'border-primary text-ink'
                : 'text-ink-muted hover:text-ink border-transparent',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
