'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/misc';

/** Client-only wrappers: these read the browser's storage. */
export const MyCvsClient = dynamic(() => import('./my-cvs').then((m) => m.MyCvs), {
  ssr: false,
  loading: () => <Skeleton className="h-28 w-full rounded-md" />,
});

export const ContinueCardClient = dynamic(
  () => import('./continue-card').then((m) => m.ContinueCard),
  { ssr: false },
);

export const DocumentsHubClient = dynamic(
  () => import('./documents-hub').then((m) => m.DocumentsHub),
  { ssr: false, loading: () => <Skeleton className="h-28 w-full rounded-md" /> },
);
