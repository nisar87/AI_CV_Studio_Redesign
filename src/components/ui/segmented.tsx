'use client';

import { useId, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Radio group styled as a segmented control (for ≤ 4 options). Arrow keys move selection. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    const opt = options[next];
    if (opt) {
      onChange(opt.value);
      refs.current[next]?.focus();
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={id} className="text-ink text-sm font-semibold">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="border-line-strong bg-sunken inline-flex rounded-md border p-1"
      >
        {options.map((opt, i) => {
          const checked = opt.value === value;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'h-9 flex-1 rounded-[7px] px-3 text-sm font-semibold transition-colors duration-150',
                checked ? 'bg-surface text-ink shadow-1' : 'text-ink-muted hover:text-ink',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
