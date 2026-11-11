'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FileText, Pencil, Trash2, Upload } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { DocumentPreview } from '@/features/preview/document-preview';
import { duplicateDocument } from '@/modules/resume/ops';
import type { ResumeDocument } from '@/modules/resume/schema';
import { getRepository } from '@/modules/storage/repository';
import { getTemplate } from '@/modules/templates/registry';
import { useAccount } from '@/features/account/account-context';

function load(): ResumeDocument[] {
  const repo = getRepository();
  return repo
    .list()
    .map((s) => repo.get(s.id))
    .filter((d): d is ResumeDocument => d !== null);
}

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MyCvs() {
  const toast = useToast();
  const router = useRouter();
  const [docs, setDocs] = useState<ResumeDocument[]>(load);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = () => setDocs(load());
  // CVs can also arrive from the account (sync on another device).
  useEffect(() => getRepository().subscribe(() => setDocs(load())), []);
  const repo = getRepository();
  const account = useAccount();
  const signedIn = account.status === 'signedIn';

  const remove = (doc: ResumeDocument) => {
    repo.remove(doc.id);
    refresh();
    toast.show({
      message: `“${doc.title}” deleted`,
      action: {
        label: 'Undo',
        onAction: () => {
          repo.save(doc);
          refresh();
        },
      },
    });
  };

  const duplicate = (doc: ResumeDocument) => {
    repo.save(duplicateDocument(doc));
    refresh();
    toast.show({ message: 'Copy created', tone: 'success' });
  };

  const backupAll = () => {
    const blob = new Blob([JSON.stringify(repo.exportAll(), null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ai-cv-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  const restore = async (file: File) => {
    try {
      if (file.size > 5_000_000) throw new Error('This file is too large to be a backup.');
      const result = repo.importAll(JSON.parse(await file.text()));
      refresh();
      toast.show({
        tone: result.added ? 'success' : 'error',
        message: result.added
          ? `${result.added} CV${result.added === 1 ? '' : 's'} restored${result.skipped ? ` (${result.skipped} could not be read)` : ''}`
          : 'No CVs could be read from this file',
      });
    } catch (e) {
      toast.show({
        tone: 'error',
        message:
          e instanceof Error && e.message.includes('backup')
            ? e.message
            : 'This file is not an AI CV Studio backup.',
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Banner
        tone="info"
        title={
          signedIn ? 'Your CVs are saved to your account' : 'Your CVs are saved in this browser'
        }
        action={
          <div className="flex flex-wrap gap-2">
            {docs.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Download aria-hidden size={16} />}
                onClick={backupAll}
              >
                Download a backup
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              icon={<Upload aria-hidden size={16} />}
              onClick={() => fileInput.current?.click()}
            >
              Restore from a backup
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void restore(f);
                e.target.value = '';
              }}
            />
          </div>
        }
      >
        {signedIn ? (
          <>
            They appear on every device where you sign in
            {account.sync === 'syncing'
              ? ' · Saving…'
              : account.sync === 'offline'
                ? ' · Offline, will save when you’re back online'
                : ''}
            .
          </>
        ) : (
          <>
            Clearing your browser data removes them.{' '}
            <Link
              href="/signin?next=/cv"
              className="text-primary font-semibold underline underline-offset-4"
            >
              Sign in
            </Link>{' '}
            to keep them safe in your account and use them on other devices.
          </>
        )}
      </Banner>

      {docs.length === 0 ? (
        <div className="border-line-strong bg-surface flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary inline-flex size-14 items-center justify-center rounded-full">
            <FileText aria-hidden size={26} />
          </span>
          <h2 className="text-xl font-semibold">No CVs on this device yet</h2>
          <p className="text-ink-muted max-w-md">
            When you create a CV, it is saved here so you can come back to it.
          </p>
          <ButtonLink href="/start">Create a CV</ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-3">
              <Link
                href={`/cv/${doc.id}`}
                className="group bg-surface shadow-page ring-primary block overflow-hidden rounded-[4px] transition-shadow hover:ring-2"
                aria-label={`Open ${doc.title}`}
              >
                <div className="pointer-events-none">
                  <DocumentPreview
                    doc={doc}
                    firstPageOnly
                    decorative
                    debounceMs={0}
                    title={`Thumbnail of ${doc.title}`}
                  />
                </div>
              </Link>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">
                    <Link href={`/cv/${doc.id}`} className="hover:underline">
                      {doc.title}
                    </Link>
                  </h2>
                  <p className="text-ink-muted text-sm">
                    {getTemplate(doc.design.templateId).name} · edited {when(doc.updatedAt)}
                  </p>
                </div>
                <Menu
                  label={`Options for ${doc.title}`}
                  items={[
                    {
                      label: 'Edit',
                      icon: <Pencil aria-hidden size={16} />,
                      onSelect: () => router.push(`/cv/${doc.id}`),
                    },
                    {
                      label: 'Download',
                      icon: <Download aria-hidden size={16} />,
                      onSelect: () => router.push(`/cv/${doc.id}/download`),
                    },
                    {
                      label: 'Make a copy',
                      icon: <Copy aria-hidden size={16} />,
                      onSelect: () => duplicate(doc),
                    },
                    {
                      label: 'Delete',
                      icon: <Trash2 aria-hidden size={16} />,
                      danger: true,
                      onSelect: () => remove(doc),
                    },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
