'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';

const SkillPlans = dynamic(() => import('./skill-plans').then((m) => m.SkillPlans), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full rounded-xl" />,
});

export function SkillsClient() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
      <SkillPlans />
    </Suspense>
  );
}
