import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Folded-corner page mark. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" className={className}>
      <path
        d="M6 4h14l6 6v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        fill="var(--color-primary)"
      />
      <path d="M20 4v4a2 2 0 0 0 2 2h4" fill="#7fb3ab" />
      <rect x="8.5" y="14" width="11" height="2.2" rx="1.1" fill="#fff" />
      <rect x="8.5" y="18.5" width="15" height="1.6" rx=".8" fill="#fff" fillOpacity=".7" />
      <rect x="8.5" y="22" width="12" height="1.6" rx=".8" fill="#fff" fillOpacity=".7" />
    </svg>
  );
}

export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn('text-ink inline-flex items-center gap-2.5 rounded-sm', className)}
      aria-label="AI CV Studio — home"
    >
      <LogoMark />
      <span className="font-display text-[19px] leading-none font-semibold tracking-tight whitespace-nowrap">
        <span className="text-primary mr-1 align-[1px] text-[12px] font-bold tracking-[0.08em] uppercase">
          AI
        </span>
        CV Studio
      </span>
    </Link>
  );
}
