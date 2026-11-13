import type { Metadata } from 'next';
import { StudioHomeClient } from '@/features/studio-home/client';

export const metadata: Metadata = { title: 'Home', robots: { index: false } };

export default function StudioPage() {
  return <StudioHomeClient />;
}
