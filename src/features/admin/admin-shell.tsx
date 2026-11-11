'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { History, LayoutDashboard, ShieldAlert, SlidersHorizontal, Users } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useAccount } from '@/features/account/account-context';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: SlidersHorizontal },
  { href: '/admin/history', label: 'History & audit', icon: History },
];

/** Admin layout. The server checks the admin claim on every API call; this only shapes the UI. */
export function AdminShell({ children }: { children: ReactNode }) {
  const account = useAccount();
  const pathname = usePathname();
  if (account.status === 'loading')
    return <div className="skeleton m-8 h-64 rounded-lg" aria-busy="true" aria-label="Loading" />;
  if (!account.user?.admin)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <ShieldAlert aria-hidden size={36} className="text-ink-muted" />
        <h1 className="font-display text-3xl font-semibold">Administrators only</h1>
        <p className="text-ink-muted">
          {account.status === 'signedOut'
            ? 'Please sign in with an administrator account.'
            : 'This account is not an administrator.'}
        </p>
        {account.status === 'signedOut' && (
          <ButtonLink href="/signin?next=/admin">Sign in</ButtonLink>
        )}
      </div>
    );
  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-4 py-6 md:grid-cols-[220px_1fr] md:px-8">
      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col">
        <p className="text-ink-subtle hidden px-3 pb-2 text-xs font-semibold tracking-wide uppercase md:block">
          Admin Console
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-[15px] font-semibold',
                active
                  ? 'bg-primary-soft text-primary'
                  : 'text-ink-muted hover:bg-sunken hover:text-ink',
              )}
            >
              <Icon aria-hidden size={18} /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function AdminHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight">
        {title}
      </h1>
      {intro && <p className="text-ink-muted">{intro}</p>}
    </div>
  );
}
