'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { useAccount } from '@/features/account/account-context';
import { ShellBottom, ShellTop } from './studio-shell';

const HINT = 'aicv.shell';

/**
 * Visitors get the marketing top bar and footer; signed-in people get the studio shell.
 * While the account is loading, a remembered hint picks the likely chrome so it doesn't flash.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const { status } = useAccount();
  const hint = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(HINT) === '1';
      } catch {
        return false;
      }
    },
    () => false,
  );
  useEffect(() => {
    try {
      if (status === 'signedIn') localStorage.setItem(HINT, '1');
      else if (status === 'signedOut') localStorage.removeItem(HINT);
    } catch {}
  }, [status]);
  const shell = status === 'signedIn' || (status === 'loading' && hint);
  // One tree for both chromes: <main> keeps its place so the page never remounts on a switch.
  return (
    <div
      className={shell ? 'min-h-dvh md:pl-60' : 'flex min-h-dvh flex-col'}
      data-shell={shell ? 'studio' : 'site'}
    >
      <Top shell={shell} />
      <main
        id="main"
        className={shell ? 'min-h-dvh pb-20 md:pb-0' : 'min-h-[calc(100dvh-4rem)] flex-1'}
      >
        {children}
      </main>
      <Bottom shell={shell} />
    </div>
  );
}

function Top({ shell }: { shell: boolean }) {
  // The announcement (set in the Console) shows in both chromes.
  return shell ? (
    <>
      <ShellTop />
      <AnnouncementBar />
    </>
  ) : (
    <>
      <AnnouncementBar />
      <SiteHeader />
    </>
  );
}

function Bottom({ shell }: { shell: boolean }) {
  return shell ? <ShellBottom /> : <SiteFooter />;
}
