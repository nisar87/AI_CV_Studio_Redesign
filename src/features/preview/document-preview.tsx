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
  /** A click on the page. `text` is the clicked element's own text (for edit on the page). */
  onSelect?: (ref: string, text?: string) => void;
  /**
   * Edit on the page: `can` says whether the clicked text is one field the person can edit in
   * place; `commit` receives the change when they press Enter or click away.
   */
  inlineEdit?: {
    can: (ref: string, text: string) => boolean;
    commit: (ref: string, original: string, text: string) => void;
  };
  className?: string;
  title?: string;
  /** Illustration only (gallery, thumbnails): hidden from assistive tech and not focusable. */
  decorative?: boolean;
  /** Build the document only once it scrolls near the viewport (long galleries). */
  lazy?: boolean;
};

const GAP = 24;
/** How long a build may take before it is loaded again once. */
const RETRY_MS = 5000;

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
  inlineEdit,
  className,
  title = 'CV preview',
  decorative = false,
  lazy = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!lazy);
  useEffect(() => {
    if (inView || !wrapRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, [inView]);
  const frames = useRef<(HTMLIFrameElement | null)[]>([null, null]);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  // Build sequence per frame: only the newest document may become visible.
  const slotSeq = useRef<[number, number]>([0, 0]);
  const seq = useRef(0);
  const firstBuild = useRef(true);
  const retry = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(retry.current), []);
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null]);
  const slotsRef = useRef<[string | null, string | null]>([null, null]);
  // Last ready result per frame, so a frame that already shows the wanted document can be
  // re-activated without reloading (e.g. undo back to the previous version).
  const slotResult = useRef<[PreviewStatus | null, PreviewStatus | null]>([null, null]);
  const [pages, setPages] = useState(1);
  const cbs = useRef({ onStatus, onSelect, inlineEdit });
  useEffect(() => {
    cbs.current = { onStatus, onSelect, inlineEdit };
  });

  const page = PAGE_DIMENSIONS[doc.design.pageSize];

  // Build the document (debounced) and load it into the inactive frame; it becomes active when ready.
  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(
      () => {
        firstBuild.current = false;
        const html = buildDocumentHtml(doc, {
          fonts: { kind: 'url', baseUrl: window.location.origin },
        });
        const s = slotsRef.current;
        const a = activeRef.current;
        if (s[a] === html) return; // already showing this exact document
        const target = s[a] === null ? a : 1 - a;
        slotSeq.current[target] = ++seq.current;
        const ready = slotResult.current[target];
        if (s[target] === html && ready) {
          // Same document is loaded and ready in the other frame: just show it.
          activeRef.current = target;
          setActive(target);
          setPages(Math.max(1, ready.pages));
          cbs.current.onStatus?.(ready);
          return;
        }
        slotResult.current[target] = null;
        const next: [string | null, string | null] = target === 0 ? [html, s[1]] : [s[0], html];
        slotsRef.current = next;
        setSlots(next);
        // Safety net: a build that never reports back would leave the frame at its old page count
        // (clipping the CV). Reload it once with a marker so the browser runs it again.
        const mySeq = slotSeq.current[target];
        window.clearTimeout(retry.current);
        retry.current = window.setTimeout(() => {
          if (slotSeq.current[target] !== mySeq || slotResult.current[target]) return;
          const again: [string | null, string | null] = [...slotsRef.current];
          again[target] = `${html}<!-- retry -->`;
          slotsRef.current = again;
          setSlots(again);
        }, RETRY_MS);
      },
      firstBuild.current ? 0 : debounceMs,
    );
    return () => window.clearTimeout(t);
  }, [doc, debounceMs, inView]);

  // Messages from the document.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const idx = frames.current.findIndex((f) => f?.contentWindow === e.source);
      if (idx < 0 || typeof e.data !== 'object' || !e.data) return;
      if (e.data.type === 'cv:ready') {
        const result = e.data.result as PreviewStatus;
        slotResult.current[idx] = result;
        if ((slotSeq.current[idx] ?? 0) < (slotSeq.current[activeRef.current] ?? 0)) return; // stale document
        setPages(Math.max(1, result.pages));
        activeRef.current = idx;
        setActive(idx);
        cbs.current.onStatus?.(result);
      } else if (e.data.type === 'cv:select' && typeof e.data.ref === 'string') {
        const text = typeof e.data.text === 'string' ? e.data.text : '';
        const edit = cbs.current.inlineEdit;
        if (edit && e.data.token && text && edit.can(e.data.ref, text))
          frames.current[idx]?.contentWindow?.postMessage(
            { type: 'cv:edit', token: e.data.token, ref: e.data.ref },
            '*',
          );
        cbs.current.onSelect?.(e.data.ref, text);
      } else if (e.data.type === 'cv:edit-done' && e.data.changed) {
        // That frame's page was edited in place, so it no longer matches its HTML: never reuse it.
        const s = slotsRef.current;
        s[idx] = s[idx] === null ? null : `${s[idx]}<!-- edited -->`;
        cbs.current.inlineEdit?.commit(
          String(e.data.ref),
          String(e.data.original ?? ''),
          String(e.data.text ?? ''),
        );
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
      // Before the width is measured, reserve the page's shape so nothing shifts when it renders.
      style={s ? { height: docHeight * s } : { aspectRatio: `${page.widthPx} / ${docHeight}` }}
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
