import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Container } from '@/components/ui/misc';
import { StartFlow } from '@/features/start/start-flow';

export const metadata: Metadata = { title: 'Create your CV' };

export default function StartPage() {
  return (
    <Container className="max-w-[880px] py-10 md:py-14">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          What kind of work do you do?
        </h1>
        <p className="text-ink-muted text-lg">
          Choose the closest one. It helps us ask the right questions — you can change anything
          later.
        </p>
      </div>
      <div className="mt-8">
        <Suspense>
          <StartFlow />
        </Suspense>
      </div>
    </Container>
  );
}
