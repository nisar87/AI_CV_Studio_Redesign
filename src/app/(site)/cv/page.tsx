import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/misc';
import { MyCvsClient } from '@/features/library/client';

export const metadata: Metadata = { title: 'My CVs' };

export default function MyCvsPage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          My CVs
        </h1>
        <ButtonLink href="/start">Create a new CV</ButtonLink>
      </div>
      <MyCvsClient />
    </Container>
  );
}
