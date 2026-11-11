'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

const controlBase =
  'w-full rounded-sm border bg-surface px-3 text-base text-ink placeholder:text-ink-subtle transition-colors duration-150 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:bg-sunken disabled:text-ink-muted';

type FieldShellProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

/** Label + control + hint/error, wired for screen readers. */
export function FieldShell({ label, hint, error, optional, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-ink text-sm font-semibold">
        {label}
        {optional && <span className="text-ink-subtle ml-1.5 font-normal">(optional)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={hintId} className="text-danger flex items-start gap-1.5 text-sm">
          <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-ink-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  containerClassName?: string;
};

export function TextField({
  label,
  hint,
  error,
  optional,
  containerClassName,
  className,
  ...rest
}: TextFieldProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={containerClassName}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            controlBase,
            'h-11',
            invalid ? 'border-danger' : 'border-line-strong',
            className,
          )}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

type TextAreaProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  containerClassName?: string;
};

export function TextArea({
  label,
  hint,
  error,
  optional,
  containerClassName,
  className,
  rows = 4,
  ...rest
}: TextAreaProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={containerClassName}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            controlBase,
            'min-h-24 resize-y py-2.5 leading-6',
            invalid ? 'border-danger' : 'border-line-strong',
            className,
          )}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
