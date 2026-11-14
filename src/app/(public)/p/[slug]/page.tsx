import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PortfolioPage } from '@/features/portfolio/portfolio-page';
import { track } from '@/modules/metrics/server';
import { contactOpen, resolvePortfolio } from '@/modules/portfolio/server';
import { resolveTheme } from '@/modules/portfolio/themes';
import { getUserStore } from '@/modules/store';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolvePortfolio((await params).slug);
  if (!r) return { title: 'Page not found', robots: { index: false } };
  const b = r.doc.basics;
  const description = (b.summary || b.headline || '').slice(0, 160);
  return {
    title: { absolute: [b.name, b.headline].filter(Boolean).join(' — ') || 'Portfolio' },
    description,
    openGraph: { title: b.name, description, type: 'profile' },
  };
}

/** A person's public portfolio page (Premium), made from one of their CVs. */
export default async function PortfolioRoute({ params }: Props) {
  const { slug } = await params;
  const r = await resolvePortfolio(slug);
  if (!r) notFound();
  // Awaited: on Cloud Run, work left running after the response may never finish.
  await getUserStore()
    .bumpPortfolioViews(slug)
    .catch(() => {});
  await track('portfolio_view');
  const p = r.portfolio;
  return (
    <PortfolioPage
      doc={r.doc}
      portfolio={p}
      theme={resolveTheme(p.theme, r.doc)}
      imageSrc={(id) => `/p/${encodeURIComponent(p.slug)}/img/${encodeURIComponent(id)}`}
      contactOpen={await contactOpen(p)}
    />
  );
}
