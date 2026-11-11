'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'neutral' | 'success' | 'error';
type ToastInput = {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onAction: () => void };
  /** Milliseconds; defaults to 5000, or 8000 when an action is present. */
  duration?: number;
};
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ show: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      const duration = t.duration ?? (t.action ? 8000 : 5000);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)]"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'bg-ink shadow-2 pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-md px-4 py-3 text-sm text-white',
              'animate-[toast-in_200ms_var(--ease-studio)]',
            )}
          >
            {t.tone === 'success' && (
              <CircleCheck aria-hidden size={18} className="shrink-0 text-[#8fd3a8]" />
            )}
            {t.tone === 'error' && (
              <CircleAlert aria-hidden size={18} className="shrink-0 text-[#f4a39b]" />
            )}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="rounded-sm px-2 py-1 font-semibold text-[#f6c97f] hover:bg-white/10"
                onClick={() => {
                  t.action?.onAction();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss notification"
              className="rounded-sm p-1 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => dismiss(t.id)}
            >
              <X aria-hidden size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
