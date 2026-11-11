import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'error';

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'border-info/30 bg-info-soft',
    icon: <Info aria-hidden size={20} className="text-info" />,
  },
  success: {
    box: 'border-success/30 bg-success-soft',
    icon: <CircleCheck aria-hidden size={20} className="text-success" />,
  },
  warning: {
    box: 'border-warning/30 bg-warning-soft',
    icon: <TriangleAlert aria-hidden size={20} className="text-warning" />,
  },
  error: {
    box: 'border-danger/30 bg-danger-soft',
    icon: <CircleAlert aria-hidden size={20} className="text-danger" />,
  },
};

type BannerProps = {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  className,
}: BannerProps) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-md border px-4 py-3 text-sm', t.box, className)}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="text-ink font-semibold">{title}</p>}
        {children && <div className="text-ink-muted">{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-ink-muted -m-1 rounded-sm p-1 hover:bg-black/5"
        >
          <X aria-hidden size={16} />
        </button>
      )}
    </div>
  );
}
