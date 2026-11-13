'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/misc';

export const StoriesClient = dynamic(() => import('./story-bank').then((m) => m.StoryBank), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full rounded-xl" />,
});
