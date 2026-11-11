import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CreateDocument } from '@/features/start/create-document';
import { StudioLoading } from '@/features/studio/with-document';

export const metadata: Metadata = { title: 'Create your CV', robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<StudioLoading />}>
      <CreateDocument />
    </Suspense>
  );
}
