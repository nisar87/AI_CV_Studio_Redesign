import type { ComponentProps, ReactNode } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ChipProps = Omit<ComponentProps<'button'>, 'children'> & {
  children: ReactNode;
  selected?: boolean;
  /** "toggle" shows + / ✓; "remove" shows ×. */
  mode?: 'toggle' | 'remove';
};

export function Chip({
  children,
  selected,
  mode = 'toggle',
  className,
  type = 'button',
  ...rest
}: ChipProps) {
  const Icon = mode === 'remove' ? X : selected ? Check : Plus;
  return (
    <button
      type={type}
      aria-pressed={mode === 'toggle' ? Boolean(selected) : undefined}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-150',
        selected
          ? 'border-primary bg-primary-soft text-primary'
          : 'border-line-strong bg-surface text-ink hover:bg-sunken',
        className,
      )}
      {...rest}
    >
      {children}
      <Icon aria-hidden size={14} strokeWidth={2.5} />
    </button>
  );
}

type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-ink-muted',
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({
  tone = 'neutral',
  className,
  ...rest
}: ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        badgeTones[tone],
        className,
      )}
      {...rest}
    />
  );
}
