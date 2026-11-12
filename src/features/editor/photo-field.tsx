'use client';

import { useId, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ops } from '@/modules/resume/ops';
import { getTemplate } from '@/modules/templates/registry';
import type { DocumentEditor } from './use-document-editor';

const SIZE = 480;

/** Centre-crop to a square, resize and compress in the browser. Nothing is uploaded anywhere. */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(file.type))
    throw new Error('Please choose a photo (JPG, PNG or WebP).');
  if (file.size > 15_000_000)
    throw new Error('This photo is too large. Please choose one under 15 MB.');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  // Portraits usually have the face in the upper part: bias the crop upwards a little.
  const sy = Math.max(
    0,
    (bitmap.height - side) / 2 - (bitmap.height > bitmap.width ? side * 0.12 : 0),
  );
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this photo.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  let quality = 0.86;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (url.length > 300_000 && quality > 0.5) {
    quality -= 0.08;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  return url;
}

export function PhotoField({ editor }: { editor: DocumentEditor }) {
  const { doc, update } = editor;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photo = doc.basics.photo;
  const supports = getTemplate(doc.design.templateId).photo !== 'none';
  const hidden = doc.design.options.showPhoto === false;

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const url = await imageFileToDataUrl(file);
      update((d) =>
        ops.setDesign(ops.updateBasics(d, { photo: url }), { options: { showPhoto: true } }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not use this photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-ink text-sm font-semibold">
        Photo <span className="text-ink-subtle font-normal">(optional)</span>
      </p>
      <div className="flex items-center gap-4">
        <div className="border-line bg-sunken text-ink-subtle flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={photo} alt="Your photo" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden size={24} />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            loadingText="Preparing…"
            onClick={() => input.current?.click()}
            aria-describedby={`${id}-hint`}
          >
            {photo ? 'Change photo' : 'Add a photo'}
          </Button>
          {photo && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 aria-hidden size={16} />}
              onClick={() => update((d) => ops.updateBasics(d, { photo: '' }))}
            >
              Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-ink-muted text-sm">
          {photo && !supports
            ? 'This design doesn’t show photos. Pick one marked “Photo” in Design to show it.'
            : photo && hidden
              ? 'Your photo is hidden. You can show it again in Design.'
              : 'Some countries expect a photo, others prefer none. It’s saved with this CV.'}
        </p>
      )}
    </div>
  );
}
