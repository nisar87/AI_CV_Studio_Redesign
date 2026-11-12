import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LinkedinScreen } from '@/features/linkedin/linkedin-screen';

export const metadata: Metadata = { title: 'Your LinkedIn profile' };

export default function LinkedinPage() {
  return (
    <Suspense>
      <LinkedinScreen />
    </Suspense>
  );
}
