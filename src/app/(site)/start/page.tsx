import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { FileUp } from 'lucide-react';
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
      <Link
        href="/cv/import"
        className="border-line bg-surface hover:border-primary mt-6 flex items-center gap-3 rounded-lg border p-4 transition-colors"
      >
        <FileUp aria-hidden className="text-primary shrink-0" />
        <span>
          <span className="font-semibold">Already have a CV?</span>{' '}
          <span className="text-ink-muted">
            Import your PDF or Word file and give it a new design.
          </span>
        </span>
      </Link>
      <div className="mt-8">
        <Suspense>
          <StartFlow />
        </Suspense>
      </div>
    </Container>
  );
}
