'use client';

import { useCallback, useState } from 'react';
import type { ResumeDocument } from '@/modules/resume/schema';
import { resolveDesign } from '@/modules/templates/design';
import { getTemplate } from '@/modules/templates/registry';

const MM = 96 / 25.4;
export const resolvePage = (doc: ResumeDocument) =>
  resolveDesign(doc.design, getTemplate(doc.design.templateId).support).page;

/** Shows a page-sized HTML document scaled down to the width of its container. */
export function ScaledPage({
  html,
  widthMm,
  heightMm,
  title = 'Cover letter preview',
}: {
  title?: string;
  html: string;
  widthMm: number;
  heightMm: number;
}) {
  const [scale, setScale] = useState(0.5);
  const w = widthMm * MM;
  const h = heightMm * MM;
  const box = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const ro = new ResizeObserver(([e]) => e && setScale(e.contentRect.width / w));
      ro.observe(el);
      return () => ro.disconnect();
    },
    [w],
  );
  return (
    <div
      ref={box}
      className="border-line relative w-full overflow-hidden rounded-md border bg-white"
      style={{ height: h * scale }}
    >
      <iframe
        title={title}
        srcDoc={html}
        sandbox="allow-scripts"
        data-testid="letter-preview"
        style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        className="absolute top-0 left-0 border-0"
      />
    </div>
  );
}
