import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PortfolioPage } from '@/features/portfolio/portfolio-page';
import { THEMES, THEME_INFO, type Theme } from '@/modules/portfolio/themes';
import { engineer } from '@/modules/resume/fixtures';

type Props = { params: Promise<{ theme: string }> };
const isTheme = (t: string): t is Theme => (THEMES as readonly string[]).includes(t);

export function generateStaticParams() {
  return THEMES.map((theme) => ({ theme }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { theme } = await params;
  if (!isTheme(theme)) return { title: 'Page not found', robots: { index: false } };
  return {
    title: `${THEME_INFO[theme].name} portfolio theme — sample`,
    description: `${THEME_INFO[theme].hint}. A sample portfolio page made with AI CV Studio.`,
    robots: { index: false },
  };
}

/** A sample portfolio page in one theme (linked from the gallery and the theme picker). */
export default async function PortfolioThemeSample({ params }: Props) {
  const { theme } = await params;
  if (!isTheme(theme)) notFound();
  return (
    <PortfolioPage
      doc={engineer}
      theme={theme}
      contactOpen
      preview
      portfolio={{
        slug: 'sample',
        showEmail: false,
        showPhone: false,
        sections: [
          {
            id: 'looking',
            title: 'What I’m looking for',
            text: 'A backend or platform role in a small product team, where reliability matters and engineers talk to the people who use what they build.\n\nOpen to remote work in Europe.',
            link: '',
            linkLabel: '',
          },
        ],
        projects: [
          {
            id: 'p1',
            title: 'Rate limiter library',
            text: 'An open-source token-bucket rate limiter for Node.js, used by two internal teams.',
            link: 'https://github.com/',
            images: [],
          },
          {
            id: 'p2',
            title: 'On-call handbook',
            text: 'A short guide to incident response that cut the time to first response in half.',
            link: '',
            images: [],
          },
        ],
      }}
      banner={
        <>
          A sample page in the {THEME_INFO[theme].name} theme.{' '}
          <Link href="/portfolio" className="font-semibold underline underline-offset-2">
            Make your own
          </Link>
        </>
      }
    />
  );
}
