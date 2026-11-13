'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Modal dialog on the native <dialog> element: the browser traps focus, closes on Escape and
 * restores focus to the opener. Clicking the backdrop closes it too.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  hideTitle = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // React's autoFocus runs before the dialog opens; mark the field with data-autofocus instead.
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'bg-surface text-ink shadow-page m-auto w-[min(100vw-2rem,34rem)] rounded-xl p-0 backdrop:bg-black/40',
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className={cn('text-xl font-semibold', hideTitle && 'sr-only')}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-ink-muted hover:bg-sunken -m-1 ml-auto inline-flex size-10 items-center justify-center rounded-md"
            >
              <X aria-hidden size={20} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
