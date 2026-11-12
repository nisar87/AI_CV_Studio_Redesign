import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { JobsBoard } from '@/features/jobs/jobs-board';

export const metadata: Metadata = { title: 'Job tracker', robots: { index: false } };

export default function JobsPage() {
  return (
    <Container className="max-w-[1280px] py-10 md:py-14">
      <div className="mb-6 flex max-w-2xl flex-col gap-2">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          Job tracker
        </h1>
        <p className="text-ink-muted text-lg">
          Every job you’re going for, where you are with it, and which CV you sent.
        </p>
      </div>
      <JobsBoard />
    </Container>
  );
}
