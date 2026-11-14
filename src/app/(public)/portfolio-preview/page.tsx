import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioPreview } from '@/features/portfolio/portfolio-preview';

export const metadata: Metadata = {
  title: 'Preview your portfolio page',
  robots: { index: false, follow: false },
};

export default function PortfolioPreviewRoute() {
  return (
    <Suspense>
      <PortfolioPreview />
    </Suspense>
  );
}
