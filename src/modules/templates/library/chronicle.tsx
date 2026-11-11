import {
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Chronicle — a career told as a timeline. Dates sit in a left gutter beside a fine vertical
 * line with a marker at every role; everything else aligns to the same content edge.
 */

function splitDates(d: string): [string, string] {
  const [a, b] = d.split(' – ');
  return [a ?? '', b ?? ''];
}

const hooks: TemplateHooks = {
  heading: (s) => <h2 className="ch-h">{s.title}</h2>,
  summary: (t) => <p className="ch-summary">{t}</p>,
  entryHead: (e) => {
    const [from, to] = splitDates(e.dates);
    return (
      <div className="ch-entry-head">
        {e.dates && (
          <p className="ch-when">
            <span>{to ? `${from} –` : from}</span>
            {to && <span className="ch-to">{to}</span>}
          </p>
        )}
        <h3 className="ch-title">{e.title || e.subtitle}</h3>
        {(e.title ? e.subtitle : '') || e.meta ? (
          <p className="ch-sub">
            {e.title && e.subtitle && <span className="ch-org">{e.subtitle}</span>}
            {e.title && e.subtitle && e.meta && <span className="ch-dot"> · </span>}
            {e.meta && <span className="ch-meta">{e.meta}</span>}
          </p>
        ) : null}
      </div>
    );
  },
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <p>
        <strong className="ch-strong">{e.title}</strong>
        {e.label && <span className="ch-muted"> — {e.label}</span>}
      </p>
    ) : (
      <div className="ch-compact">
        {e.dates && <span className="ch-when ch-when--compact">{e.dates}</span>}
        <p>
          <strong className="ch-strong">{e.title}</strong>
          {joinParts([e.subtitle, e.meta]) && (
            <span className="ch-muted"> — {joinParts([e.subtitle, e.meta])}</span>
          )}
        </p>
      </div>
    ),
  skills: (e) => (
    <div className="ch-skills">
      {e.label && <p className="ch-skill-label">{e.label}</p>}
      <ul className="ch-tags">
        {e.tags.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="ch-header">
      <div className="ch-top">
        <div className="ch-id">
          <h1 className="ch-name">{model.name || 'Your name'}</h1>
          {model.headline && <p className="ch-headline">{model.headline}</p>}
        </div>
        <Portrait model={model} className="ch-portrait" fallback="none" />
      </div>
      {model.contacts.length > 0 && (
        <div className="ch-contact-bar">
          <ContactList contacts={model.contacts} icons />
        </div>
      )}
    </header>
  );
}

const css = `
:root{--gutter:25mm;--line-x:21.5mm}
.ch-header{padding-bottom:3mm}
.ch-top{display:flex;align-items:center;justify-content:space-between;gap:8mm}
.ch-id{min-width:0}
.ch-name{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:2.75em;line-height:1.05;letter-spacing:-.015em;color:var(--ink)}
.ch-headline{margin-top:.3em;font-size:1.18em;font-weight:500;color:var(--accent)}
.ch-portrait{width:28mm;height:28mm;border-radius:50%;box-shadow:0 0 0 2pt #fff,0 0 0 3.2pt var(--accent)}
.ch-contact-bar{margin-top:5mm;background:var(--accent-tint);border-radius:3pt;padding:6pt 9pt;border-left:2.5pt solid var(--accent)}
.ch-contact-bar .cv-contacts{column-gap:0;row-gap:.3em;font-size:.97em;color:var(--ink-2)}
.ch-contact-bar .cv-contact{padding-right:1.3em}
.cv-top--running{padding-bottom:3mm}
.ch-running{display:flex;justify-content:space-between;align-items:baseline;border-bottom:.6pt solid var(--accent-line);padding-bottom:3pt;font-size:.85em;color:var(--ink-3)}
.ch-running strong{font-family:var(--font-heading);font-weight:var(--heading-weight);color:var(--ink);font-size:1.15em}
.b-heading{padding-top:var(--section-gap);padding-bottom:6pt}
.ch-h{display:flex;align-items:center;gap:.6em;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.2em;color:var(--ink);letter-spacing:-.005em}
.ch-h::after{content:'';flex:1;height:.6pt;background:var(--rule)}
.cv-main [data-block]:not(.b-heading){padding-left:var(--gutter)}
.k-experience,.k-volunteering,.k-education,.k-projects{position:relative}
.k-experience:not(.b-heading)::before,.k-volunteering:not(.b-heading)::before,.k-education:not(.b-heading)::before,.k-projects:not(.b-heading)::before{
  content:'';position:absolute;left:var(--line-x);top:0;bottom:0;width:1pt;background:var(--accent-line)}
.k-experience.b-first::before,.k-volunteering.b-first::before,.k-education.b-first::before,.k-projects.b-first::before{top:5pt}
.ch-entry-head{position:relative;padding-bottom:2.5pt}
.b-entry .ch-entry-head::before{content:'';position:absolute;left:calc(var(--line-x) - var(--gutter) - 3.2pt);top:calc(var(--lh) * 0.5em - 2.6pt);width:7.4pt;height:7.4pt;border-radius:50%;background:#fff;border:1.8pt solid var(--accent);box-sizing:border-box}
.ch-when{position:absolute;left:calc(-1 * var(--gutter));top:.15em;width:calc(var(--line-x) - 3.5mm);font-size:.82em;line-height:1.35;color:var(--ink-3);font-variant-numeric:tabular-nums;display:flex;flex-direction:column}
.ch-when span:first-child{color:var(--accent);font-weight:700}
.ch-to{color:var(--ink-3)}
.ch-compact{position:relative}
.ch-when--compact{display:block;color:var(--accent);font-weight:700}
.ch-title{font-family:var(--font-body);font-size:1.07em;font-weight:700;color:var(--ink)}
.ch-sub{margin-top:.05em;font-size:.97em}
.ch-org{font-weight:600;color:var(--ink-2)}
.ch-meta,.ch-dot{color:var(--ink-3)}
.b-entry{padding-top:var(--item-gap)}
.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:3.5pt}
.b-skills{padding-top:4pt}
.b-compact.b-first,.b-skills.b-first{padding-top:1pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li+li{margin-top:1.5pt}
.ch-summary{color:var(--ink-2);font-size:1.02em}
.ch-strong{font-weight:600;color:var(--ink)}
.ch-muted{color:var(--ink-3)}
.ch-skill-label{font-weight:600;margin-bottom:3pt}
.ch-tags{display:flex;flex-wrap:wrap;gap:4pt}
.ch-tags li{padding:1.5pt 6.5pt;border-radius:10pt;border:.75pt solid var(--accent-line);color:var(--ink);font-size:.93em;line-height:1.35}
`;

export const chronicle: TemplateDefinition = {
  id: 'chronicle',
  name: 'Chronicle',
  description:
    'Your career as a timeline: dates in a margin column beside a fine line with a marker for every role.',
  style: 'Timeline',
  tags: ['Timeline', 'Photo', 'Clear dates'],
  photo: 'optional',
  support: {
    headerAlign: ['left'],
    skillStyle: ['tags'],
    defaults: { headerAlign: 'left', skillStyle: 'tags', fontPair: 'classic' },
  },
  asideKinds: [],
  css,
  hooks,
  Header,
  Running: ({ model }) => (
    <div className="ch-running">
      <strong>{model.name}</strong>
      <span>{model.headline}</span>
    </div>
  ),
};
