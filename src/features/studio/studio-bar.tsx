'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, CircleAlert, Cloud, Redo2, Undo2 } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { LogoMark } from '@/components/layout/logo';
import { Spinner } from '@/components/ui/spinner';
import { ops } from '@/modules/resume/ops';
import { useAccount } from '@/features/account/account-context';
import type { DocumentEditor } from '@/features/editor/use-document-editor';

export function SaveStatus({ state }: { state: DocumentEditor['saveState'] }) {
  const signedIn = useAccount().status === 'signedIn';
  return (
    <p
      aria-live="polite"
      className="text-ink-muted flex items-center gap-1.5 text-sm whitespace-nowrap"
    >
      {state === 'saving' && (
        <>
          <Spinner size={14} /> <span>Saving…</span>
        </>
      )}
      {state === 'saved' && (
        <>
          <Cloud aria-hidden size={16} />{' '}
          <span className="hidden sm:inline">
            {signedIn ? 'Saved to your account' : 'Saved on this device'}
          </span>
          <span className="sm:hidden">Saved</span>
        </>
      )}
      {state === 'error' && (
        <span className="text-danger flex items-center gap-1.5">
          <CircleAlert aria-hidden size={16} /> Not saved — storage is full or blocked
        </span>
      )}
    </p>
  );
}

type Props = {
  editor: DocumentEditor;
  backHref: string;
  backLabel: string;
  action?: ReactNode;
};

export function StudioBar({ editor, backHref, backLabel, action }: Props) {
  const { doc, update } = editor;
  return (
    <header className="border-line bg-surface z-20 flex h-16 shrink-0 items-center gap-2 border-b px-2 sm:gap-3 sm:px-4">
      <Link
        href={backHref}
        className="text-ink hover:bg-sunken inline-flex h-11 items-center gap-2 rounded-md px-2 text-[15px] font-semibold"
        aria-label={backLabel}
      >
        <ArrowLeft aria-hidden size={20} />
        <LogoMark size={24} className="hidden sm:block" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <label htmlFor="doc-title" className="sr-only">
          CV name
        </label>
        <input
          id="doc-title"
          value={doc.title}
          onChange={(e) => update((d) => ops.rename(d, e.target.value), 'title')}
          onBlur={(e) => !e.target.value.trim() && update((d) => ops.rename(d, 'My CV'))}
          className="text-ink hover:border-line focus-visible:border-primary h-8 w-full max-w-72 min-w-0 truncate rounded-sm border border-transparent bg-transparent px-1.5 text-[16px] font-semibold focus-visible:outline-none"
        />
        <div className="px-1.5">
          <SaveStatus state={editor.saveState} />
        </div>
      </div>
      <IconButton
        label="Undo"
        icon={<Undo2 aria-hidden size={20} />}
        disabled={!editor.canUndo}
        onClick={editor.undo}
      />
      <IconButton
        label="Redo"
        icon={<Redo2 aria-hidden size={20} />}
        disabled={!editor.canRedo}
        onClick={editor.redo}
        className="hidden sm:inline-flex"
      />
      {action}
    </header>
  );
}
