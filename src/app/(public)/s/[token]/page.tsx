import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedCv } from '@/features/share/shared-cv';
import { track } from '@/modules/metrics/server';
import { resolveShare } from '@/modules/share/server';
import { getUserStore } from '@/modules/store';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolveShare((await params).token);
  return {
    title: r ? `${r.doc.basics.name || 'CV'} — CV` : 'Link not available',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/** A read-only view of the latest version of someone's CV, via a link they shared. */
export default async function SharedCvPage({ params }: Props) {
  const { token } = await params;
  const r = await resolveShare(token);
  if (!r) notFound();
  // Awaited: on Cloud Run, work left running after the response may never finish.
  await getUserStore()
    .bumpShareViews(token, new Date().toISOString())
    .catch(() => {});
  await track('share_view');
  return <SharedCv doc={r.doc} />;
}
