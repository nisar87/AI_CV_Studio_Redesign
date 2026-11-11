import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'My CVs' };

export default function MyCvsPage() {
  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
        My CVs
      </h1>
      <div className="border-line-strong bg-surface mt-8 flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
        <span className="bg-primary-soft text-primary inline-flex size-14 items-center justify-center rounded-full">
          <FileText aria-hidden size={26} />
        </span>
        <h2 className="text-xl font-semibold">No CVs on this device yet</h2>
        <p className="text-ink-muted max-w-md">
          When you create a CV, it is saved here in your browser so you can come back to it.
        </p>
        <ButtonLink href="/start">Create a CV</ButtonLink>
      </div>
    </Container>
  );
}
