import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Designs' };

/** Phase 1 shell. Phase 2 renders real templates with sample CVs. */
export default function TemplatesPage() {
  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
        Designs
      </h1>
      <p className="text-ink-muted mt-3 max-w-2xl text-lg">
        A small set of carefully made designs that look professional with any amount of experience.
      </p>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {['Clarity', 'Meridian', 'Heritage'].map((name) => (
          <li key={name} className="flex flex-col gap-3">
            <div className="bg-surface shadow-page aspect-[210/297] rounded-[4px]" />
            <p className="font-semibold">{name}</p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
