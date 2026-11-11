import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  /** Accessible name; also shown as a tooltip. */
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'outlined';
  size?: 'sm' | 'md';
};

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'text-ink inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45',
        size === 'md' ? 'size-11' : 'size-9',
        variant === 'ghost'
          ? 'hover:bg-sunken'
          : 'border-line-strong bg-surface hover:bg-sunken border',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
