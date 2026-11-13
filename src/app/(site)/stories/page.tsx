import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { StoriesClient } from '@/features/stories/client';

export const metadata: Metadata = { title: 'Story bank', robots: { index: false } };

export default function StoriesPage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mb-8 flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          Story bank
        </h1>
        <p className="text-ink-muted text-lg">
          Your best work stories, written once: situation, what you did and the result. They are
          ready for mock interviews, the coach and your letters.
        </p>
      </div>
      <StoriesClient />
    </Container>
  );
}
