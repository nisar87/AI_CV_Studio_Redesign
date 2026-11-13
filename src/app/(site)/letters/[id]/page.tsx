import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Container } from '@/components/ui/misc';
import { LetterScreenClient } from '@/features/letters/client';

export const metadata: Metadata = { title: 'Letter', robots: { index: false } };

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Container className="max-w-[1280px] py-8 md:py-10">
      <Suspense>
        <LetterScreenClient id={id} />
      </Suspense>
    </Container>
  );
}
