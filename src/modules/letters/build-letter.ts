import type { ResumeDocument } from '@/modules/resume/schema';
import { designCssVars, resolveDesign } from '@/modules/templates/design';
import { fontFaceCss, type FontSource } from '@/modules/templates/fonts';
import { getTemplate } from '@/modules/templates/registry';
import type { Letter } from './schema';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Text still waiting for the person ({{?…}}) is highlighted so it can't go out unnoticed. */
const mark = (s: string) => esc(s).replace(/\{\{\?([^{}]*)\}\}/g, '<mark class="ask">[$1]</mark>');

/**
 * A cover letter that matches a CV: same accent, fonts and paper size. Self-contained HTML (CSP,
 * no network) printed by the same PDF renderer as CVs; reports its page count like a CV.
 */
export function buildLetterHtml(
  cv: ResumeDocument,
  l: Pick<Letter, 'greeting' | 'paragraphs' | 'closing'>,
  /** A job's cover letter (title, company) or a library letter (recipient lines and subject). */
  job: { title: string; company: string; to?: string[]; subject?: string; kind?: string },
  opts: { fonts: FontSource; date?: Date },
): string {
  const t = getTemplate(cv.design.templateId);
  const d = resolveDesign(cv.design, t.support);
  const b = cv.basics;
  const date = (opts.date ?? new Date()).toLocaleDateString(cv.locale || 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const contacts = [b.email, b.phone, b.location].filter(Boolean).map(esc).join(' · ');
  const fontSrc = opts.fonts.kind === 'url' ? new URL(opts.fonts.baseUrl).origin : '';
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `font-src data: ${fontSrc}`.trim(),
    "script-src 'unsafe-inline'",
  ].join('; ');
  const css = `
@page{size:${d.page.widthMm}mm ${d.page.heightMm}mm;margin:0}
*{box-sizing:border-box}html,body{margin:0;background:#fff}
body{font-family:var(--font-body);font-size:calc(var(--fs) * 1.04);line-height:1.55;color:var(--ink)}
.page{width:var(--page-w);min-height:var(--page-h);padding:22mm 24mm 20mm;position:relative}
.bar{position:absolute;inset:0 0 auto 0;height:5mm;background:var(--accent)}
h1{font-family:var(--font-heading);font-weight:var(--heading-weight);color:var(--accent);font-size:22pt;margin:0 0 2pt;line-height:1.15}
.head .role{color:var(--ink-2);margin:0}
.head .contact{color:var(--ink-3);font-size:.92em;margin:4pt 0 0}
.meta{margin:18pt 0 14pt;color:var(--ink-2)}
.meta p{margin:0}
.re{font-weight:600;color:var(--ink);margin-top:10pt!important}
.body p{margin:0 0 10pt}
.sign{margin-top:16pt}.sign .name{font-weight:600;margin-top:22pt}
mark.ask{background:#fff1c2;color:inherit;padding:0 2px;border-radius:2px}
@media screen{body{background:#eef0f2}.page{margin:0 auto;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)}}`;
  const library = job.subject !== undefined || job.to !== undefined;
  const meta = library
    ? `${(job.to ?? [])
        .filter((t) => t.trim())
        .map((t) => `<p>${esc(t)}</p>`)
        .join('')}${job.subject ? `<p class="re">${esc(job.subject)}</p>` : ''}`
    : `${job.company ? `<p>${esc(job.company)}</p>` : ''}<p class="re">${esc(job.title ? `Application: ${job.title}` : 'Application')}</p>`;
  const kind = job.kind ?? 'cover letter';
  const body = `<div class="page"><div class="bar"></div>
<header class="head"><h1>${esc(b.name || 'Your name')}</h1>${b.headline ? `<p class="role">${esc(b.headline)}</p>` : ''}${contacts ? `<p class="contact">${contacts}</p>` : ''}</header>
<div class="meta"><p>${esc(date)}</p>${meta}</div>
<div class="body"><p>${mark(l.greeting)}</p>${l.paragraphs
    .filter((p) => p.trim())
    .map((p) => `<p>${mark(p)}</p>`)
    .join('')}</div>
<div class="sign"><p>${mark(l.closing)}</p><p class="name">${esc(b.name)}</p></div></div>`;
  const ready = `document.fonts.ready.then(function(){var h=document.querySelector('.page').scrollHeight;window.__CV_READY__={pages:Math.max(1,Math.round(h/(${d.page.heightMm}*96/25.4))),overflow:0,nearlyFits:false};document.documentElement.setAttribute('data-cv-ready','1');try{parent.postMessage({type:'cv:ready',result:window.__CV_READY__},'*')}catch(e){}});`;
  return `<!DOCTYPE html><html lang="${esc(cv.locale.split('-')[0] || 'en')}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${esc(csp)}"><meta name="viewport" content="width=device-width">
<title>${esc(b.name ? `${b.name} — ${kind}` : kind.charAt(0).toUpperCase() + kind.slice(1))}</title>
<style>${fontFaceCss(d.fontPairId, opts.fonts)}</style><style>${designCssVars(d)}${css}</style></head>
<body>${body}<script>${ready}</script></body></html>`;
}
