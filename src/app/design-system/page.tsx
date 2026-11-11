import { notFound } from 'next/navigation';
import { Showcase } from '@/features/design-system/showcase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Design system', robots: { index: false } };

/** Internal component showcase. Available in development, or when SHOW_DESIGN_SYSTEM=1. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production' && process.env.SHOW_DESIGN_SYSTEM !== '1') notFound();
  return <Showcase />;
}
