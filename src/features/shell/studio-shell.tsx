'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleHelp, CircleUserRound, Plus, Search } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Menu } from '@/components/ui/menu';
import { Logo } from '@/components/layout/logo';
import { useAccount } from '@/features/account/account-context';
import { cn } from '@/lib/cn';
import { CommandPalette } from './command-palette';
import { CREATE, DESTINATIONS, isActive } from './destinations';

/**
 * Signed-in studio shell (complete-studio-spec §11.1): a left rail on desktop and a bottom bar on
 * phones with five destinations, a Create button, the profile menu and Ctrl/Cmd+K.
 * Split into the parts before and after <main> so the page itself stays mounted when the chrome
 * switches (SiteChrome), e.g. when sign-in finishes loading.
 */
export function ShellTop() {
  const pathname = usePathname();
  const router = useRouter();
  const account = useAccount();
  const [create, setCreate] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const profileItems = [
    { label: 'Career profile', onSelect: () => router.push('/profile') },
    { label: 'My designs', onSelect: () => router.push('/templates') },
    { label: 'Plan and Premium', onSelect: () => router.push('/premium') },
    { label: 'Account and settings', onSelect: () => router.push('/account') },
    { label: 'Help', onSelect: () => router.push('/help') },
    ...(account.user?.admin
      ? [{ label: 'Admin Console', onSelect: () => router.push('/admin') }]
      : []),
  ];
  const avatar = (
    <Menu
      label="Profile menu"
      align="left"
      above
      items={profileItems}
      trigger={{
        content: (
          <>
            <CircleUserRound aria-hidden size={22} />
            <span className="max-w-32 truncate">{account.user?.name || 'Profile'}</span>
          </>
        ),
        className:
          'text-ink-muted hover:bg-sunken hover:text-ink inline-flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-[15px] font-semibold',
      }}
    />
  );

  return (
    <>
      <a
        href="#main"
        className="bg-primary text-on-primary sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      {/* Desktop rail */}
      <aside
        className="border-line bg-paper fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-4 border-r p-4 md:flex"
        aria-label="Studio"
      >
        <Logo href="/studio" className="px-2 py-1" />
        <button
          type="button"
          onClick={() => setCreate(true)}
          className="bg-primary text-on-primary hover:bg-primary-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold"
        >
          <Plus aria-hidden size={18} /> Create
        </button>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {DESTINATIONS.map((d) => {
            const active = isActive(pathname, d);
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold',
                  active
                    ? 'bg-primary-soft text-primary'
                    : 'text-ink-muted hover:bg-sunken hover:text-ink',
                )}
              >
                <d.icon aria-hidden size={20} /> {d.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="border-line-strong text-ink-muted hover:bg-sunken mt-2 inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm"
        >
          <Search aria-hidden size={16} /> Search
          <span className="sr-only">or jump to</span>
          <kbd className="bg-sunken ml-auto rounded px-1.5 text-xs">Ctrl K</kbd>
        </button>
        <div className="mt-auto flex flex-col gap-1">
          <Link
            href="/help"
            className="text-ink-muted hover:bg-sunken inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-[15px] font-semibold"
          >
            <CircleHelp aria-hidden size={20} /> Help
          </Link>
          {avatar}
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="border-line bg-paper/95 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 md:hidden">
        <Logo href="/studio" />
        <button
          type="button"
          onClick={() => setCreate(true)}
          aria-label="Create"
          className="bg-primary text-on-primary ml-auto inline-flex size-11 items-center justify-center rounded-md"
        >
          <Plus aria-hidden size={20} />
        </button>
        <Menu
          label="Profile menu"
          items={profileItems}
          trigger={{
            content: (
              <>
                <CircleUserRound aria-hidden size={22} />
                <span className="sr-only">Profile menu</span>
              </>
            ),
            className:
              'text-ink-muted hover:bg-sunken inline-flex size-11 items-center justify-center rounded-md',
          }}
        />
      </header>

      <Dialog open={create} onClose={() => setCreate(false)} title="Create">
        <ul className="grid gap-2 sm:grid-cols-2">
          {CREATE.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                onClick={() => setCreate(false)}
                className="border-line hover:border-primary hover:bg-primary-soft/40 flex min-h-16 items-center gap-3 rounded-lg border p-3"
              >
                <span className="bg-primary-soft text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-md">
                  <c.icon aria-hidden size={20} />
                </span>
                <span>
                  <span className="block font-semibold">{c.label}</span>
                  <span className="text-ink-muted block text-sm">{c.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </>
  );
}

export function ShellBottom() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="border-line bg-paper fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t md:hidden"
    >
      {DESTINATIONS.map((d) => {
        const active = isActive(pathname, d);
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold',
              active ? 'text-primary' : 'text-ink-muted',
            )}
          >
            <d.icon aria-hidden size={20} />
            {d.label}
          </Link>
        );
      })}
    </nav>
  );
}
