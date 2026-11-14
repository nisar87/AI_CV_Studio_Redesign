'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from '@/features/account/account-context';
import { resolveTheme, THEMES, THEME_INFO, type Theme } from '@/modules/portfolio/themes';
import { getRepository } from '@/modules/storage/repository';
import { readDraft } from './draft';
import { PortfolioPage } from './portfolio-page';

/**
 * The owner's preview of their portfolio page, from the settings they haven't saved yet
 * (R9.8). `?theme=` shows another theme. Pictures come from the owner's own picture route.
 */
export function PortfolioPreview() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const account = useAccount();
  const params = useSearchParams();
  if (!mounted || account.status === 'loading')
    return <div className="skeleton m-8 h-96 rounded-lg" aria-busy="true" aria-label="Loading" />;
  const draft = readDraft();
  const doc = draft ? getRepository().get(draft.docId) : null;
  if (!draft || !doc)
    return (
      <main id="main" className="mx-auto max-w-[640px] px-5 py-16">
        <h1 className="font-display text-3xl font-semibold">Nothing to preview yet</h1>
        <p className="text-ink-muted mt-2">
          Open{' '}
          <Link href="/portfolio" className="text-primary font-semibold underline">
            your portfolio settings
          </Link>{' '}
          and press Preview.
        </p>
      </main>
    );
  const asked = params.get('theme');
  const theme: Theme = THEMES.includes(asked as Theme)
    ? (asked as Theme)
    : resolveTheme(draft.theme, doc);
  return (
    <PortfolioPage
      doc={doc}
      portfolio={draft}
      theme={theme}
      imageSrc={(id) => `/api/portfolio/images/${encodeURIComponent(id)}`}
      contactOpen={draft.contact}
      preview
      banner={
        <>
          Preview in the {THEME_INFO[theme].name} theme — only you can see this.{' '}
          <Link href="/portfolio" className="font-semibold underline underline-offset-2">
            Back to settings
          </Link>
        </>
      }
    />
  );
}
