import type { ResolvedDesign } from './design';

/** Page mechanics shared by every template. Template stylesheets add the look. */
export function baseCss(d: ResolvedDesign): string {
  return `
@page{size:${d.page.widthMm}mm ${d.page.heightMm}mm;margin:0}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:transparent}
body{font-family:var(--font-body);font-size:var(--fs);line-height:var(--lh);color:var(--ink);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;font-kerning:normal;
  text-rendering:optimizeLegibility;font-variant-numeric:lining-nums;overflow-wrap:break-word;hyphens:manual}
h1,h2,h3,p,ul{margin:0;padding:0}
ul{list-style:none}
[data-cv-source]{position:absolute;left:-20000px;top:0;width:var(--page-w);visibility:hidden}
.cv-measure{position:absolute;left:-20000px;top:0;visibility:hidden}
[data-cv-pages]{display:flex;flex-direction:column;align-items:flex-start;gap:24px}
.cv-page{position:relative;width:var(--page-w);height:var(--page-h);background:#fff;overflow:hidden;
  display:flex;flex-direction:column;padding:var(--margin) var(--margin) calc(var(--margin) + 2.5mm)}
.cv-top{flex:none;position:relative;z-index:1}
.cv-body{position:relative;z-index:1}
.cv-decor{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.cv-icon{width:1em;height:1em;flex:none;display:inline-block;vertical-align:-.13em}
.cv-contacts--icons .cv-contact{display:flex;align-items:center;gap:.45em}
.cv-contacts--icons .cv-icon{color:var(--accent);width:.95em;height:.95em}
.cv-contacts--stacked .cv-contacts{flex-direction:column;flex-wrap:nowrap;margin-left:0;row-gap:.35em}
.cv-contacts--stacked .cv-contact{padding-left:0;align-items:flex-start}
.cv-contacts--stacked .cv-icon{margin-top:.22em}
.cv-contacts--stacked .cv-contact-text{min-width:0;overflow-wrap:break-word}
.cv-contacts--stacked .cv-contact-label{display:none}
.cv-portrait{flex:none;overflow:hidden;position:relative}
.cv-portrait img{display:block;width:100%;height:100%;object-fit:cover}
.cv-portrait--initials{display:flex;align-items:center;justify-content:center}
.cv-body{flex:1 1 auto;min-height:0;display:flex;align-items:stretch}
.cv-main{flex:1 1 auto;min-width:0;overflow:hidden}
.cv-aside{flex:none;overflow:hidden}
/* Continuation pages without side-column content use the full width. */
.cv-page.cv-page--wide .cv-main{padding-left:0;padding-right:0;border:0}
/* Every block is positioned so Chrome paints (and PDF text extraction reads) blocks strictly in
   document order. Without this, positioned children (e.g. bullet items) were painted after all
   in-flow text, so extracted text listed every bullet after the last section. */
[data-block]{display:flow-root;position:relative}
a{color:inherit;text-decoration:none}
/* Continuation chunk of a split skill group: sits directly under the previous chunk. */
.b-skills.b-cont{padding-top:3.5pt}
/* Continuation headers: keep name and role apart; stack them when they don't fit side by side. */
.cv-top--running > *{column-gap:2.5em;flex-wrap:wrap}
p,li{text-wrap:pretty}
h1,h2,h3{text-wrap:balance}
.cv-foot{position:absolute;right:var(--margin);bottom:calc(var(--margin) * 0.45);font-size:7.5pt;
  color:var(--ink-3);letter-spacing:.04em;font-variant-numeric:tabular-nums}
.cv-bullets li{position:relative;padding-left:1.05em}
.cv-bullets li::before{content:'';position:absolute;left:.15em;top:calc(var(--lh) * 0.5em - 0.11em);
  width:.3em;height:.3em;border-radius:50%;background:var(--accent)}
.cv-contacts-wrap{overflow:hidden}
.cv-contacts{display:flex;flex-wrap:wrap;row-gap:.15em;margin-left:-1.4em}
.cv-contact{padding-left:1.4em;position:relative}
.cv-sep{position:absolute;left:0;width:1.4em;text-align:center;color:var(--accent-line)}
[data-ref]{cursor:default}
@media screen{ .cv-page{box-shadow:0 1px 3px rgba(27,31,36,.08),0 10px 30px -12px rgba(27,31,36,.25)} }
@media print{
  [data-cv-pages]{display:block}
  .cv-page{box-shadow:none;break-after:page}
  .cv-page:last-child{break-after:auto}
}`;
}
