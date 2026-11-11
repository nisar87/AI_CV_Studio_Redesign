'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import { getRepository } from '@/modules/storage/repository';

/** "Continue your CV" for returning visitors (Home). Renders nothing for new visitors. */
export function ContinueCard() {
  const [latest] = useState(() => getRepository().list()[0] ?? null);
  if (!latest) return null;
  return (
    <Link
      href={`/cv/${latest.id}`}
      className="border-primary/30 bg-surface shadow-1 hover:border-primary flex w-full max-w-md items-center gap-3 rounded-lg border p-3 pr-4"
    >
      <span className="bg-primary-soft text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-md">
        <FileText aria-hidden size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink-muted text-sm">Continue where you left off</span>
        <span className="truncate font-semibold">
          {latest.name ? `${latest.title} — ${latest.name}` : latest.title}
        </span>
      </span>
      <ArrowRight aria-hidden size={18} className="text-primary" />
    </Link>
  );
}
