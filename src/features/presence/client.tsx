'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/misc';

/** Client-only: the hub reads the browser's CV titles. */
export const PresenceHubClient = dynamic(
  () => import('./presence-hub').then((m) => m.PresenceHub),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
  },
);
