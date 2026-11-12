import type { Metadata } from 'next';
import { PortfolioSettings } from '@/features/portfolio/portfolio-settings';

export const metadata: Metadata = { title: 'Your portfolio page' };

export default function PortfolioSettingsPage() {
  return <PortfolioSettings />;
}
