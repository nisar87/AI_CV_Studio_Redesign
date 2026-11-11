'use client';

import dynamic from 'next/dynamic';
import { StudioLoading, WithDocument } from './with-document';

/*
 * Studio screens read the browser's storage, so they render on the client only.
 * Each screen is code-split; a skeleton shows while it loads.
 */
const Editor = dynamic(
  () => import('@/features/editor/editor-screen').then((m) => m.EditorScreen),
  {
    ssr: false,
    loading: StudioLoading,
  },
);
const Guided = dynamic(
  () => import('@/features/guided/guided-screen').then((m) => m.GuidedScreen),
  {
    ssr: false,
    loading: StudioLoading,
  },
);
const Download = dynamic(
  () => import('@/features/download/download-screen').then((m) => m.DownloadScreen),
  {
    ssr: false,
    loading: StudioLoading,
  },
);
const Gate = dynamic(() => Promise.resolve(WithDocument), { ssr: false, loading: StudioLoading });

export function EditorPage({ id }: { id: string }) {
  return <Gate id={id}>{(doc) => <Editor initial={doc} />}</Gate>;
}
export function GuidedPage({ id }: { id: string }) {
  return <Gate id={id}>{(doc) => <Guided initial={doc} />}</Gate>;
}
export function DownloadPage({ id }: { id: string }) {
  return <Gate id={id}>{(doc) => <Download doc={doc} />}</Gate>;
}
