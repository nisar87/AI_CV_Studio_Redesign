import type { ComponentProps } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={cn('border-line bg-surface shadow-1 rounded-lg border', className)} {...rest} />
  );
}

type SelectableCardProps = ComponentProps<'button'> & { selected?: boolean };

/** A large tappable card that behaves like a radio option or a navigation choice. */
export function SelectableCard({
  selected,
  className,
  children,
  type = 'button',
  ...rest
}: SelectableCardProps) {
  return (
    <button
      type={type}
      className={cn(
        'bg-surface shadow-1 relative flex w-full flex-col items-start gap-1 rounded-lg border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150',
        'hover:border-primary hover:shadow-2',
        selected ? 'border-primary bg-primary-soft border-2' : 'border-line',
        className,
      )}
      {...rest}
    >
      {selected && (
        <span className="bg-primary text-on-primary absolute top-3 right-3 inline-flex size-6 items-center justify-center rounded-full">
          <Check aria-hidden size={14} strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}
