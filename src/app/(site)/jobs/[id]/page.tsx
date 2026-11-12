import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { JobDetail } from '@/features/jobs/job-detail';

export const metadata: Metadata = { title: 'Job', robots: { index: false } };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Container className="max-w-[1200px] py-8 md:py-10">
      <JobDetail id={id} />
    </Container>
  );
}
