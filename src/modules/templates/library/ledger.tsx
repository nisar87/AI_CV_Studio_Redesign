import {
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Ledger — Swiss editorial. An oversized name over a heavy rule, numbered section labels in a
 * left column, content on a strict grid. Monochrome by default, with a single accent.
 */

const hooks: TemplateHooks = {
  heading: () => <span className="l-rule" aria-hidden="true" />,
  label: (s) => (
    <h2 className="l-h">
      <span className="l-num" aria-hidden="true" />
      <span className="l-label">{s.title}</span>
    </h2>
  ),
  summary: (t) => <p className="l-summary">{t}</p>,
  entryHead: (e) => (
    <div className="l-entry-head">
      <div className="l-row">
        <h3 className="l-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="l-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="l-sub">{joinParts([e.title ? e.subtitle : '', e.meta], ', ')}</p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <p className="l-compact">
        <strong>{e.title}</strong>
        {e.label && <span className="l-muted"> — {e.label}</span>}
      </p>
    ) : (
      <div className="l-row l-compact">
        <p>
          <strong>{e.title}</strong>
          {joinParts([e.subtitle, e.meta]) && (
            <span className="l-muted">, {joinParts([e.subtitle, e.meta])}</span>
          )}
        </p>
        {e.dates && <span className="l-dates">{e.dates}</span>}
      </div>
    ),
  skills: (e) => (
    <p className="l-skills">
      {e.label && <strong>{e.label}</strong>}
      {e.label && <span className="l-slash"> / </span>}
      {e.tags.map((t, i) => (
        <span key={i}>
          {i > 0 && <span className="l-slash"> / </span>}
          {t}
        </span>
      ))}
    </p>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="l-header">
      <div className="l-masthead">
        <div className="l-id">
          <h1 className="l-name">{model.name || 'Your name'}</h1>
          {model.headline && <p className="l-headline">{model.headline}</p>}
        </div>
        <Portrait model={model} className="l-portrait" fallback="none" />
      </div>
      {model.contacts.length > 0 && <ContactList contacts={model.contacts} separator="/" />}
    </header>
  );
}

const css = `
:root{--label-w:27%}
body{counter-reset:sec}
.l-header{padding-bottom:5.5mm;border-bottom:2.6pt solid var(--ink)}
.l-masthead{display:flex;align-items:flex-end;justify-content:space-between;gap:8mm}
.l-id{min-width:0}
.l-name{font-family:var(--font-heading);font-weight:800;font-size:3.5em;line-height:.98;letter-spacing:-.035em;word-spacing:.12em;color:var(--ink)}
.l-headline{margin-top:.45em;font-size:1.2em;font-weight:500;color:var(--accent);letter-spacing:-.005em}
.l-portrait{width:27mm;height:33mm;border-radius:1.5pt;filter:saturate(.9)}
.l-header .cv-contacts-wrap{margin-top:4.5mm}
.l-header .cv-contacts{font-size:.92em;color:var(--ink-2)}
.l-header .cv-sep{color:var(--accent);font-weight:600}
.cv-top--running{padding-bottom:3mm}
.l-running{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.4pt solid var(--ink);padding-bottom:3pt}
.l-running strong{font-family:var(--font-heading);font-weight:800;letter-spacing:-.02em;font-size:1.2em}
.l-running span{color:var(--ink-3);font-size:.85em}
.cv-main [data-block]:not(.b-heading):not(.b-first){padding-left:var(--label-w)}
.b-labelled{display:flex}
.b-label{width:var(--label-w);flex:none;padding-right:5mm}
.b-content{flex:1;min-width:0}
.b-heading{position:relative;padding-top:var(--section-gap);counter-increment:sec}
.b-heading::before{content:'';position:absolute;left:0;right:0;top:calc(var(--section-gap) * 0.45);height:.6pt;background:var(--rule)}
.l-h{padding-top:1pt}
.l-num::before{content:counter(sec, decimal-leading-zero);display:block;font-family:var(--font-heading);font-weight:800;font-size:1.25em;letter-spacing:-.02em;color:var(--accent);line-height:1;margin-bottom:3pt;font-variant-numeric:tabular-nums}
.l-label{display:block;overflow-wrap:normal;hyphens:auto;font-family:var(--font-body);font-size:.76em;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--ink);line-height:1.35}
.b-first{padding-top:2pt}
.b-entry{padding-top:var(--item-gap)}
.b-entry.b-first,.b-summary.b-first,.b-skills.b-first,.b-compact.b-first{padding-top:2pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:3pt}
.b-list > div:first-child{padding-top:0}
.b-skills{padding-top:3pt}
.l-row{display:flex;justify-content:space-between;align-items:baseline;gap:1em}
.l-title{font-family:var(--font-body);font-size:1.06em;font-weight:700;color:var(--ink)}
.l-dates{flex:none;font-size:.88em;color:var(--ink-3);white-space:nowrap;font-variant-numeric:tabular-nums}
.l-sub{color:var(--ink-2);margin-top:.05em}
.l-entry-head{padding-bottom:2.5pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li::before{border-radius:0;width:.5em;height:.09em;top:calc(var(--lh) * 0.5em);background:var(--ink-3)}
.cv-bullets li+li{margin-top:1.5pt}
.l-summary{font-size:1.08em;line-height:1.5;color:var(--ink)}
.l-compact strong{font-weight:600}
.l-muted{color:var(--ink-3)}
.l-skills{color:var(--ink-2)}
.l-skills strong{color:var(--ink);font-weight:700}
.l-slash{color:var(--accent);font-weight:600}
`;

export const ledger: TemplateDefinition = {
  id: 'ledger',
  name: 'Ledger',
  description:
    'Bold Swiss-style layout: a large name, a strong rule and numbered section labels on a strict grid.',
  style: 'Bold editorial',
  tags: ['Large name', 'Grid', 'Photo'],
  photo: 'optional',
  support: {
    headerAlign: ['left'],
    skillStyle: ['inline'],
    defaults: { headerAlign: 'left', skillStyle: 'inline', fontPair: 'modern' },
  },
  asideKinds: [],
  css,
  hooks,
  Header,
  Running: ({ model }) => (
    <div className="l-running">
      <strong>{model.name}</strong>
      <span>{model.headline}</span>
    </div>
  ),
};
