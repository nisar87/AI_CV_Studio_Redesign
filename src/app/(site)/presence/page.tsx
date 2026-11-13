import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { PresenceHubClient } from '@/features/presence/client';

export const metadata: Metadata = { title: 'Presence', robots: { index: false } };

/** Presence hub (complete-studio-spec §11.1): everything people see of you online. */
export default function PresencePage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mb-8 flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          Presence
        </h1>
        <p className="text-ink-muted text-lg">
          How you show up online, made from the CV you already have — and how often it’s seen.
        </p>
      </div>
      <PresenceHubClient />
    </Container>
  );
}
