'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/misc';

/** Client-only: letters read the browser's CVs for their design. */
export const NewLetterClient = dynamic(() => import('./new-letter').then((m) => m.NewLetter), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
});

export const LetterScreenClient = dynamic(
  () => import('./letter-screen').then((m) => m.LetterScreen),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full rounded-xl" /> },
);

export const LetterListClient = dynamic(() => import('./letter-list').then((m) => m.LetterList), {
  ssr: false,
  loading: () => <Skeleton className="h-28 w-full rounded-md" />,
});
