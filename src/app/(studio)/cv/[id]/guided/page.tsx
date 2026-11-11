import type { Metadata } from 'next';
import { GuidedPage } from '@/features/studio/screens';

export const metadata: Metadata = { title: 'Create your CV', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GuidedPage id={id} />;
}
