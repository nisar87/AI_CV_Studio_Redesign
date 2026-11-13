'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/misc';

/** Client-only: Studio Home reads the browser's storage. */
export const StudioHomeClient = dynamic(() => import('./studio-home').then((m) => m.StudioHome), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-8 md:px-8">
      <Skeleton className="h-10 w-64 rounded-md" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  ),
});
