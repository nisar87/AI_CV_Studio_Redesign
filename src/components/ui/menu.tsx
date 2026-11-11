'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean };

/** Small action menu (WAI-ARIA menu button). Escape and outside clicks close it. */
export function Menu({
  label,
  items,
  className,
}: {
  label: string;
  items: MenuItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="text-ink-muted hover:bg-sunken hover:text-ink inline-flex size-11 items-center justify-center rounded-md"
      >
        <MoreHorizontal aria-hidden size={20} />
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className="border-line bg-surface shadow-2 absolute top-full right-0 z-30 mt-1 min-w-48 rounded-md border p-1"
          onKeyDown={(e) => {
            const idx = itemRefs.current.findIndex((el) => el === document.activeElement);
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              itemRefs.current[(idx + 1) % items.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              itemRefs.current[(idx - 1 + items.length) % items.length]?.focus();
            } else if (e.key === 'Tab') {
              close(false);
            }
          }}
        >
          {items.map((it, i) => (
            <button
              key={it.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close();
                it.onSelect();
              }}
              className={cn(
                'hover:bg-sunken focus-visible:bg-sunken flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-left text-[15px] focus-visible:outline-none',
                it.danger ? 'text-danger' : 'text-ink',
              )}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
