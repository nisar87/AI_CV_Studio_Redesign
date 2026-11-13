'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/misc';

export const CoachClient = dynamic(() => import('./coach-home').then((m) => m.CoachHome), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full rounded-xl" />,
});
