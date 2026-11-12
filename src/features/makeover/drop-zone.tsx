'use client';

import { useRef, useState, type DragEvent } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ACCEPT, fileProblem } from './state';

/**
 * The one large drop zone (spec §6.1): PDF, Word (.docx/.doc) or a photo of a paper CV.
 * Keyboard users choose with the button; the hidden input is not in the tab order.
 */
export function DropZone({
  onFile,
  busy = false,
  compact = false,
  id = 'makeover-file',
}: {
  onFile: (f: File) => void;
  busy?: boolean;
  compact?: boolean;
  id?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = (f: File | undefined) => {
    if (!f || busy) return;
    const problem = fileProblem(f);
    setError(problem);
    if (!problem) onFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    take(e.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        data-testid="drop-zone"
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed text-center transition-colors',
          compact ? 'p-6' : 'p-8 sm:p-10',
          drag ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface',
        )}
      >
        <FileUp aria-hidden size={compact ? 28 : 36} className="text-primary" />
        <p className="text-lg font-semibold">Drop your CV here</p>
        <p className="text-ink-muted text-sm">PDF, Word or a photo of a paper CV · up to 10 MB</p>
        <input
          ref={input}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose your CV file (PDF, Word or a photo)"
          data-testid="makeover-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            take(f);
          }}
        />
        <Button onClick={() => input.current?.click()} disabled={busy} size={compact ? 'md' : 'lg'}>
          Choose a file
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger text-sm" data-testid="drop-error">
          {error}
        </p>
      )}
    </div>
  );
}
