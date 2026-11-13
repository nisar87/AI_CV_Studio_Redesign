import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@/components/ui/misc';
import { DesignDetail } from '@/features/gallery/design-detail';
import { DESIGN_IDS } from '@/modules/resume/ids';
import { DESIGN_META, isDesignId } from '@/modules/design/designs';

export function generateStaticParams() {
  return DESIGN_IDS.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isDesignId(id)) return { title: 'Design' };
  const d = DESIGN_META[id];
  return { title: `${d.name} CV design`, description: d.description };
}

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDesignId(id)) notFound();
  return (
    <Container className="py-10 md:py-14">
      <Suspense>
        <DesignDetail id={id} />
      </Suspense>
    </Container>
  );
}
