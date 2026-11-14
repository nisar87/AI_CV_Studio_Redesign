'use client';

import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextArea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

/** A text box with a character count against LinkedIn's limit and a Copy button. */
export function CopyField({
  label,
  value,
  limit,
  rows,
  onChange,
  bare = false,
}: {
  label: string;
  value: string;
  limit: number;
  rows: number;
  onChange: (v: string) => void;
  /** Without its own card (inside another card). */
  bare?: boolean;
}) {
  const toast = useToast();
  const over = value.length > limit;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.show({ tone: 'success', message: `${label} copied` });
    } catch {
      toast.show({ tone: 'error', message: 'Couldn’t copy. Select the text and copy it.' });
    }
  };
  const Box = bare ? 'div' : Card;
  return (
    <Box className={bare ? 'flex flex-col gap-2' : 'flex flex-col gap-2 p-5'}>
      <TextArea
        label={label}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${over ? 'text-danger font-semibold' : 'text-ink-muted'}`}>
          {value.length} / {limit} characters{over ? ' — too long for LinkedIn' : ''}
        </span>
        <Button size="sm" variant="secondary" icon={<Copy aria-hidden size={16} />} onClick={copy}>
          Copy<span className="sr-only"> {label}</span>
        </Button>
      </div>
    </Box>
  );
}
