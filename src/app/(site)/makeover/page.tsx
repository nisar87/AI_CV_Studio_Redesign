import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Container } from '@/components/ui/misc';
import { MakeoverScreen } from '@/features/makeover/makeover-screen';

export const metadata: Metadata = {
  title: 'Instant CV makeover',
  description:
    'Upload the CV you have — PDF, Word or a photo — and see it in a professional design in under a minute. Nothing is added that isn’t in your CV.',
};

export default function MakeoverPage() {
  return (
    <Container className="max-w-[1240px] py-10 md:py-14">
      <div className="mb-8 flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          Upload your CV, see it transformed
        </h1>
        <p className="text-ink-muted text-lg">
          Drop the CV you already have. In under a minute you’ll see it in designs chosen for your
          kind of work — in your own words.
        </p>
      </div>
      <Suspense>
        <MakeoverScreen />
      </Suspense>
    </Container>
  );
}
