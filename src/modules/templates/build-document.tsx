import { renderToStaticMarkup } from 'react-dom/server.edge';
import type { ResumeDocument } from '@/modules/resume/schema';
import { baseCss } from './base-css';
import { sectionBlocks } from './blocks';
import { designCssVars, resolveDesign, type ResolvedDesign } from './design';
import { fontFaceCss, type FontSource } from './fonts';
import { RUNTIME_JS } from './paginate/runtime-source';
import { getTemplate } from './registry';
import { toRenderModel } from './render-model';

export type BuildOptions = {
  fonts: FontSource;
  /** Origin allowed for font loading in the document CSP (preview mode). */
  fontOrigin?: string;
  /** Open the browser print dialog once pages are ready (Print fallback). */
  autoPrint?: boolean;
};

const AUTO_PRINT_JS =
  '(function(){var n=0;var t=setInterval(function(){if(window.__CV_READY__||++n>100){clearInterval(t);window.print();}},100);})();';

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export function resolveDocumentDesign(doc: ResumeDocument): ResolvedDesign {
  return resolveDesign(doc.design, getTemplate(doc.design.templateId).support);
}

/**
 * Build the complete, self-contained HTML document for a CV.
 * The same string is shown in the preview iframe and printed to PDF by Chromium.
 */
export function buildDocumentHtml(doc: ResumeDocument, opts: BuildOptions): string {
  const template = getTemplate(doc.design.templateId);
  const design = resolveDesign(doc.design, template.support);
  const base = toRenderModel(doc);
  const model = template.photo === 'none' ? { ...base, photo: '' } : base;
  const aside = new Set<string>(template.asideKinds);

  const mainBlocks = model.sections
    .filter((s) => !aside.has(s.kind))
    .flatMap((s) => sectionBlocks(s, template.hooks, design));
  const asideContact =
    template.contactsIn === 'aside' && template.AsideContact && model.contacts.length > 0
      ? [
          <div
            data-block=""
            data-keep="together"
            className="b-contact"
            data-ref="basics/contact"
            key="contact"
          >
            <template.AsideContact model={model} design={design} />
          </div>,
        ]
      : [];
  const asideBlocks = model.sections
    .filter((s) => aside.has(s.kind))
    .flatMap((s) => sectionBlocks(s, template.hooks, design));
  const { Header, Running, Decor } = template;

  const body = renderToStaticMarkup(
    <>
      <div data-cv-source="">
        <div data-slot="header">
          <Header model={model} design={design} />
        </div>
        {Running && (
          <div data-slot="running">
            <Running model={model} design={design} />
          </div>
        )}
        <div data-flow="main">{mainBlocks}</div>
        {asideContact.length + asideBlocks.length > 0 && (
          <div data-flow="aside">
            {asideContact}
            {asideBlocks}
          </div>
        )}
        {Decor && (
          <div data-slot="decor">
            <Decor model={model} design={design} />
          </div>
        )}
      </div>
      <div data-cv-pages="" />
    </>,
  );

  const fontSrc =
    opts.fonts.kind === 'url' ? (opts.fontOrigin ?? new URL(opts.fonts.baseUrl).origin) : '';
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `font-src data: ${fontSrc}`.trim(),
    "script-src 'unsafe-inline'",
    'img-src data:',
  ].join('; ');

  const title = model.name ? `${model.name} — CV` : 'CV';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(doc.locale.split('-')[0] || 'en')}" data-template="${template.id}" data-photo="${model.photo ? '1' : '0'}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(title)}</title>
<style>${fontFaceCss(design.fontPairId, opts.fonts)}</style>
<style>${designCssVars(design)}${baseCss(design)}${template.css}</style>
</head>
<body>${body}<script>${RUNTIME_JS}</script>${opts.autoPrint ? `<script>${AUTO_PRINT_JS}</script>` : ''}</body>
</html>`;
}
