import type { Metadata } from 'next';
import { Hammer } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Create your CV' };

/** Phase 1 placeholder. Replaced by the guided builder in Phase 3. */
export default function NewCvPage() {
  return (
    <Container className="max-w-[720px] py-16 text-center">
      <span className="bg-accent-soft text-accent-ink mx-auto inline-flex size-14 items-center justify-center rounded-full">
        <Hammer aria-hidden size={26} />
      </span>
      <h1 className="font-display mt-4 text-3xl font-semibold">The CV builder is on its way</h1>
      <p className="text-ink-muted mt-3 text-lg">
        This preview version shows the look and feel of AI CV Studio. The step-by-step builder
        arrives in the next update.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/start" variant="secondary">
          Back
        </ButtonLink>
      </div>
    </Container>
  );
}
