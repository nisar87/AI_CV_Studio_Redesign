'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { Logo } from './logo';
import { useAccount } from '@/features/account/account-context';
import { CircleUserRound } from 'lucide-react';

const NAV = [
  { href: '/cv', label: 'My CVs' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/templates', label: 'Designs' },
  { href: '/help', label: 'Help' },
];

export function SiteHeader() {
  const pathname = usePathname();
  // The menu is open only for the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean | ((v: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(open) : value;
    setOpenOn(next ? pathname : null);
  };
  const menuButton = useRef<HTMLButtonElement>(null);
  const account = useAccount();
  const signedIn = account.status === 'signedIn';
  const accountHref = signedIn ? '/account' : '/signin';
  const accountLabel = signedIn ? 'Account' : 'Sign in';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenOn(null);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="border-line/80 bg-paper/90 supports-[backdrop-filter]:bg-paper/75 sticky top-0 z-40 border-b backdrop-blur">
      <a
        href="#main"
        className="focus:bg-surface focus:shadow-2 sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-[15px] font-semibold transition-colors',
                  active
                    ? 'bg-primary-soft text-primary'
                    : 'text-ink-muted hover:bg-sunken hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {account.status !== 'loading' && (
            <Link
              href={accountHref}
              aria-current={pathname === accountHref ? 'page' : undefined}
              className="text-ink-muted hover:bg-sunken hover:text-ink hidden items-center gap-1.5 rounded-md px-3 py-2 text-[15px] font-semibold md:inline-flex"
            >
              {signedIn && <CircleUserRound aria-hidden size={18} />}
              {accountLabel}
            </Link>
          )}
          <ButtonLink href="/start" size="sm" className="sm:h-11 sm:px-4 sm:text-[15px]">
            Create a CV
          </ButtonLink>
          <button
            ref={menuButton}
            type="button"
            className="text-ink hover:bg-sunken inline-flex size-11 items-center justify-center rounded-md md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden size={22} /> : <Menu aria-hidden size={22} />}
          </button>
        </div>
      </Container>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Main"
          className="border-line bg-surface border-t md:hidden"
        >
          <Container className="flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ink hover:bg-sunken rounded-md px-3 py-3 text-base font-semibold"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={accountHref}
              className="text-ink hover:bg-sunken rounded-md px-3 py-3 text-base font-semibold"
            >
              {accountLabel}
            </Link>
          </Container>
        </nav>
      )}
    </header>
  );
}
