import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { CoachClient } from '@/features/coach/client';

export const metadata: Metadata = { title: 'Coach', robots: { index: false } };

export default function CoachPage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mb-8 flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          Coach
        </h1>
        <p className="text-ink-muted text-lg">
          Get ready for the jobs you want: practise interview questions and see where you match.
        </p>
      </div>
      <CoachClient />
    </Container>
  );
}
