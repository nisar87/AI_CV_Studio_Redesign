'use client';

import { useState, type ReactNode } from 'react';
import { FileQuestion } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import type { ResumeDocument } from '@/modules/resume/schema';
import { getRepository } from '@/modules/storage/repository';

/** Loads a CV from this browser. Rendered client-side only (see studio pages). */
export function WithDocument({
  id,
  children,
}: {
  id: string;
  children: (doc: ResumeDocument) => ReactNode;
}) {
  const [doc] = useState(() => getRepository().get(id));
  if (!doc) return <MissingDocument />;
  return <>{children(doc)}</>;
}

export function MissingDocument() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <span className="bg-sunken text-ink-muted inline-flex size-14 items-center justify-center rounded-full">
        <FileQuestion aria-hidden size={26} />
      </span>
      <h1 className="font-display text-3xl font-semibold">We can’t find this CV</h1>
      <p className="text-ink-muted max-w-md">
        CVs are saved in the browser where they were made. It may have been deleted, or made on
        another device or browser.
      </p>
      <div className="flex gap-3">
        <ButtonLink href="/cv">My CVs</ButtonLink>
        <ButtonLink href="/start" variant="secondary">
          Create a CV
        </ButtonLink>
      </div>
    </main>
  );
}

export function StudioLoading() {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true" aria-label="Loading your CV">
      <div className="border-line bg-surface h-16 border-b" />
      <div className="flex flex-1">
        <div className="flex w-full flex-col gap-4 p-5 lg:w-[460px]">
          <div className="skeleton h-14 rounded-lg" />
          <div className="skeleton h-40 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
        </div>
        <div className="bg-sunken hidden flex-1 lg:block" />
      </div>
    </div>
  );
}
