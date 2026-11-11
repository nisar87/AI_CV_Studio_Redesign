import type { Metadata } from 'next';
import { EditorPage } from '@/features/studio/screens';

export const metadata: Metadata = { title: 'Edit your CV', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorPage id={id} />;
}
