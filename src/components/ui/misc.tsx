import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...rest }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton rounded-sm', className)} {...rest} />;
}

/** Text-first progress indicator: "Step 2 of 6 · Work history" plus a decorative bar. */
export function Stepper({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink-muted text-sm font-semibold">
        Step {current} of {total} <span aria-hidden>·</span>{' '}
        <span className="text-ink">{label}</span>
      </p>
      <div aria-hidden className="bg-sunken h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-300 ease-[var(--ease-studio)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function VisuallyHidden({ className, ...rest }: ComponentProps<'span'>) {
  return <span className={cn('sr-only', className)} {...rest} />;
}

export function Container({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-5 sm:px-8', className)} {...rest} />;
}
