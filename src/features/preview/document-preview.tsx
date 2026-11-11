'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResumeDocument } from '@/modules/resume/schema';
import { buildDocumentHtml } from '@/modules/templates/build-document';
import { PAGE_DIMENSIONS } from '@/modules/templates/design';
import { cn } from '@/lib/cn';

export type PreviewStatus = { pages: number; overflow: number; nearlyFits: boolean };

type Props = {
  doc: ResumeDocument;
  /** Scale pages to the container width ("fit") or a fixed scale. */
  scale?: 'fit' | number;
  /** Show only the first page, cropped (thumbnails). */
  firstPageOnly?: boolean;
  /** Debounce for rebuilding the document after changes (ms). */
  debounceMs?: number;
  onStatus?: (s: PreviewStatus) => void;
  onSelect?: (ref: string) => void;
  className?: string;
  title?: string;
  /** Illustration only (gallery, thumbnails): hidden from assistive tech and not focusable. */
  decorative?: boolean;
};

const GAP = 24;

/**
 * Live CV preview. Renders the exact document that is printed to PDF, inside a sandboxed iframe.
 * Uses two iframes (current + incoming) so updates never flash a blank page.
 */
export function DocumentPreview({
  doc,
  scale = 'fit',
  firstPageOnly = false,
  debounceMs = 150,
  onStatus,
  onSelect,
  className,
  title = 'CV preview',
  decorative = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frames = useRef<(HTMLIFrameElement | null)[]>([null, null]);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  // Build sequence per frame: only the newest document may become visible.
  const slotSeq = useRef<[number, number]>([0, 0]);
  const seq = useRef(0);
  const firstBuild = useRef(true);
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null]);
  const [pages, setPages] = useState(1);
  const cbs = useRef({ onStatus, onSelect });
  useEffect(() => {
    cbs.current = { onStatus, onSelect };
  });

  const page = PAGE_DIMENSIONS[doc.design.pageSize];

  // Build the document (debounced) and load it into the inactive frame; it becomes active when ready.
  useEffect(() => {
    const t = window.setTimeout(
      () => {
        firstBuild.current = false;
        const html = buildDocumentHtml(doc, {
          fonts: { kind: 'url', baseUrl: window.location.origin },
        });
        setSlots((s) => {
          const a = activeRef.current;
          const target = s[a] === null ? a : 1 - a;
          slotSeq.current[target] = ++seq.current;
          return target === 0 ? [html, s[1]] : [s[0], html];
        });
      },
      firstBuild.current ? 0 : debounceMs,
    );
    return () => window.clearTimeout(t);
  }, [doc, debounceMs]);

  // Messages from the document.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const idx = frames.current.findIndex((f) => f?.contentWindow === e.source);
      if (idx < 0 || typeof e.data !== 'object' || !e.data) return;
      if (e.data.type === 'cv:ready') {
        const result = e.data.result as PreviewStatus;
        if ((slotSeq.current[idx] ?? 0) < (slotSeq.current[activeRef.current] ?? 0)) return; // stale document
        setPages(Math.max(1, result.pages));
        activeRef.current = idx;
        setActive(idx);
        cbs.current.onStatus?.(result);
      } else if (e.data.type === 'cv:select' && typeof e.data.ref === 'string') {
        cbs.current.onSelect?.(e.data.ref);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = useMemo(
    () => (scale === 'fit' ? (width > 0 ? width / page.widthPx : 0) : scale),
    [scale, width, page.widthPx],
  );
  const shownPages = firstPageOnly ? 1 : pages;
  const docHeight = shownPages * page.heightPx + (shownPages - 1) * GAP;
  const frameHeight = firstPageOnly ? page.heightPx : pages * page.heightPx + (pages - 1) * GAP;

  return (
    <div
      ref={wrapRef}
      className={cn('relative w-full', className)}
      style={{ height: s ? docHeight * s : undefined }}
    >
      {s > 0 &&
        slots.map((src, i) =>
          src === null ? null : (
            <iframe
              key={i}
              ref={(el) => {
                frames.current[i] = el;
              }}
              title={i === active ? title : `${title} (updating)`}
              aria-hidden={i === active && !decorative ? undefined : true}
              tabIndex={i === active && !decorative ? 0 : -1}
              inert={decorative || i !== active ? true : undefined}
              data-active={i === active ? '' : undefined}
              sandbox="allow-scripts"
              srcDoc={src}
              className="absolute top-0 left-0 origin-top-left border-0 bg-transparent"
              style={{
                width: page.widthPx,
                height: frameHeight,
                transform: `scale(${s})`,
                opacity: i === active ? 1 : 0,
                pointerEvents: i === active ? 'auto' : 'none',
                zIndex: i === active ? 1 : 0,
              }}
            />
          ),
        )}
    </div>
  );
}
