import {
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Atelier — a deep, full-height colour sidebar carrying the portrait, contact details and
 * skills; a light main column with a confident stacked name. Creative but disciplined.
 */

const hooks: TemplateHooks = {
  heading: (s) => <h2 className="a-h">{s.title}</h2>,
  summary: (t) => <p className="a-summary">{t}</p>,
  entryHead: (e) => (
    <div className="a-entry-head">
      <div className="a-row">
        <h3 className="a-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="a-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="a-sub">
          {e.title && e.subtitle && <span className="a-org">{e.subtitle}</span>}
          {e.title && e.subtitle && e.meta && <span className="a-dot"> · </span>}
          {e.meta && <span className="a-meta">{e.meta}</span>}
        </p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <div className="a-lang">
        <span className="a-lang-name">{e.title}</span>
        {e.label && <span className="a-lang-level">{e.label}</span>}
      </div>
    ) : (
      <div className="a-cred">
        <p className="a-cred-title">{e.title}</p>
        {joinParts([e.subtitle, e.meta, e.dates], ' · ') && (
          <p className="a-cred-sub">{joinParts([e.subtitle, e.meta, e.dates], ' · ')}</p>
        )}
      </div>
    ),
  skills: (e) => (
    <div>
      {e.label && <p className="a-skill-label">{e.label}</p>}
      <ul className="a-tags">
        {e.tags.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="a-header">
      <div className="a-header-side">
        <Portrait model={model} className="a-portrait" />
      </div>
      <div className="a-header-main">
        <h1 className="a-name">
          <span className="a-first">{model.firstName || 'Your name'}</span>
          {model.lastName && <span className="a-last">{model.lastName}</span>}
        </h1>
        {model.headline && <p className="a-headline">{model.headline}</p>}
      </div>
    </header>
  );
}

const css = `
:root{--side-w:56mm;--side-pad:7mm;--gap:9mm}
.cv-page::before{content:'';position:absolute;top:0;bottom:0;left:0;width:calc(var(--margin) + var(--side-w) + var(--side-pad));background:var(--accent-deep)}
.cv-body{flex-direction:row-reverse}
.cv-aside{width:var(--side-w);color:#fff;font-size:.93em}
.cv-main{padding-left:calc(var(--side-pad) + var(--gap))}
.a-header{display:flex;align-items:center;padding-bottom:9mm}
.a-header-side{width:calc(var(--side-w) + var(--side-pad));padding-right:var(--side-pad);display:flex;justify-content:center;flex:none}
.a-header-main{padding-left:var(--gap);min-width:0;flex:1}
.a-portrait{width:40mm;height:40mm;border-radius:50%;box-shadow:0 0 0 2.2pt var(--accent-deep),0 0 0 3.4pt rgba(255,255,255,.55)}
.cv-portrait--initials.a-portrait{background:rgba(255,255,255,.1);color:#fff;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:30pt;letter-spacing:.02em}
.a-name{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:2.95em;line-height:1.02;letter-spacing:-.015em;color:var(--ink)}
.a-name span{display:block}
.a-last{color:var(--accent)}
.a-headline{display:flex;align-items:center;gap:.6em;margin-top:.7em;font-size:.86em;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-2)}
.a-headline::before{content:'';width:16pt;height:2pt;background:var(--accent);flex:none}
.cv-top--running{padding-bottom:5mm}
.a-running{margin-left:calc(var(--side-w) + var(--side-pad) + var(--gap));display:flex;justify-content:space-between;align-items:baseline;border-bottom:.6pt solid var(--rule);padding-bottom:3pt;font-size:.85em;color:var(--ink-3)}
.a-running strong{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.15em;color:var(--ink)}
.b-heading{padding-top:var(--section-gap);padding-bottom:6pt}
.a-h{display:flex;align-items:center;gap:.55em;font-family:var(--font-body);font-size:.84em;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:var(--ink)}
.a-h::before{content:'';width:6pt;height:6pt;background:var(--accent);flex:none;border-radius:1pt}
.cv-aside .a-h{color:#fff;font-weight:700;font-size:.8em;letter-spacing:.18em}
.cv-aside .a-h::before{display:none}
.cv-aside .a-h::after{content:'';flex:1;height:.6pt;background:rgba(255,255,255,.3)}
.cv-aside .b-heading{padding-top:calc(var(--section-gap) * 1.05)}
.b-contact{padding-top:0}
.b-contact .cv-contacts{row-gap:.55em}
.b-contact .cv-icon{color:var(--accent-bright)}
.b-contact .cv-contact-label{color:rgba(255,255,255,.7)}
.b-entry{padding-top:var(--item-gap)}
.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:5pt}
.b-compact.b-first,.b-skills.b-first{padding-top:2pt}
.b-skills{padding-top:5pt}
.a-row{display:flex;justify-content:space-between;align-items:baseline;gap:.9em}
.a-title{font-family:var(--font-body);font-size:1.07em;font-weight:700;color:var(--ink)}
.a-dates{flex:none;font-size:.86em;font-weight:600;color:var(--accent);white-space:nowrap;font-variant-numeric:tabular-nums}
.a-sub{margin-top:.08em;font-size:.96em}
.a-org{font-weight:600;color:var(--ink-2)}
.a-meta,.a-dot{color:var(--ink-3)}
.a-entry-head{padding-bottom:2.5pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li+li{margin-top:1.6pt}
.a-summary{color:var(--ink-2);font-size:1.02em}
.a-lang{display:flex;justify-content:space-between;gap:.6em}
.a-lang-name{font-weight:600}
.a-lang-level{color:rgba(255,255,255,.72);text-align:right}
.a-cred-title{font-weight:600;line-height:1.3}
.a-cred-sub{color:rgba(255,255,255,.72);font-size:.94em;margin-top:1pt}
.a-skill-label{font-weight:600;margin-bottom:3pt}
.a-tags{display:flex;flex-wrap:wrap;gap:3.5pt}
.a-tags li{padding:1.8pt 6pt;border-radius:10pt;background:rgba(255,255,255,.13);color:#fff;font-size:.95em;line-height:1.35}
.cv-aside .cv-bullets{color:rgba(255,255,255,.85)}
`;

export const atelier: TemplateDefinition = {
  id: 'atelier',
  name: 'Atelier',
  description:
    'A deep colour sidebar with your photo, contact details and skills, beside a clean main column.',
  style: 'Creative sidebar',
  tags: ['Photo', 'Colour sidebar', 'Creative'],
  photo: 'optional',
  contactsIn: 'aside',
  support: {
    headerAlign: ['left'],
    skillStyle: ['tags'],
    defaults: { headerAlign: 'left', skillStyle: 'tags', fontPair: 'modern' },
  },
  asideKinds: ['skills', 'languages', 'certifications', 'licences', 'awards'],
  css,
  hooks,
  Header,
  AsideContact: ({ model }) => (
    <>
      <h2 className="a-h">Contact</h2>
      <div style={{ height: '6pt' }} />
      <ContactList contacts={model.contacts} icons stacked />
    </>
  ),
  Running: ({ model }) => (
    <div className="a-running">
      <strong>{model.name}</strong>
      <span>{model.headline}</span>
    </div>
  ),
};
