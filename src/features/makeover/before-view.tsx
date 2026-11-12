'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * The original CV for the before/after view, drawn in the browser (nothing is kept on the
 * server): page 1 of a PDF, a photo as it is, or a Word file's text on a plain page.
 */
export function BeforeView({ file, lines }: { file: File | null; lines: string[] }) {
  const isPdf = !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
  const isImage =
    !!file && /^image\/(jpeg|png|webp)$/.test(file.type) && !/\.hei[cf]$/i.test(file.name);
  if (isPdf) return <PdfPage file={file} lines={lines} />;
  if (isImage) return <ImagePage file={file} />;
  return <TextPage lines={lines} />;
}

function ImagePage({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
  return <img src={url} alt="Your original CV" className="h-full w-full bg-white object-contain" />;
}

function PdfPage({ file, lines }: { file: File; lines: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { getDocumentProxy } = await import('unpdf');
        const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1200 / base.width);
        const viewport = page.getViewport({ scale });
        const c = canvas.current;
        if (!live || !c) return;
        c.width = Math.round(viewport.width);
        c.height = Math.round(viewport.height);
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        await page.render({ canvasContext: ctx, viewport, canvas: c } as never).promise;
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [file]);
  if (failed) return <TextPage lines={lines} />;
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label="Your original CV, page 1"
      className="h-full w-full bg-white object-contain"
    />
  );
}

function TextPage({ lines }: { lines: string[] }) {
  if (!lines.length)
    return (
      <div className="text-ink-muted flex h-full flex-col items-center justify-center gap-2 bg-white p-6 text-center text-sm">
        <ImageOff aria-hidden />
        Your original can’t be shown here, but its text was read.
      </div>
    );
  return (
    <div
      className="h-full overflow-hidden bg-white p-[6%] font-serif text-[clamp(6px,1.25vw,11px)] leading-snug text-black"
      aria-label="Your original CV as plain text"
      role="img"
    >
      {lines.slice(0, 80).map((l, i) => (
        <p key={i} className="truncate">
          {l}
        </p>
      ))}
    </div>
  );
}
