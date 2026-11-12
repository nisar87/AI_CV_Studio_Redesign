import {
  MetaText,
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { CatalogueTemplate } from '../types';

/**
 * Halo — a centred portrait framed by a fine double ring, a graceful serif name and a calm
 * two-column body. Warm, personal and polished; ideal for people-facing professions.
 */

const hooks: TemplateHooks = {
  splitSkills: true,
  heading: (s) => <h2 className="ha-h">{s.title}</h2>,
  summary: (t) => <p className="ha-summary">{t}</p>,
  entryHead: (e) => (
    <div className="ha-entry-head">
      <div className="ha-row">
        <h3 className="ha-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="ha-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="ha-sub">
          {e.title && e.subtitle && <span className="ha-org">{e.subtitle}</span>}
          {e.title && e.subtitle && e.meta && <span className="ha-dot">, </span>}
          {e.meta && (
            <span className="ha-meta">
              <MetaText e={e} />
            </span>
          )}
        </p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <div className="ha-lang">
        <span className="ha-strong">{e.title}</span>
        {e.label && <span className="ha-muted">{e.label}</span>}
      </div>
    ) : (
      <div>
        <p className="ha-strong ha-cred">{e.title}</p>
        {joinParts([e.subtitle, e.meta, e.dates], ' · ') && (
          <p className="ha-muted ha-small">{joinParts([e.subtitle, e.meta, e.dates], ' · ')}</p>
        )}
      </div>
    ),
  skills: (e) => (
    <div>
      {e.label && <p className="ha-skill-label">{e.label}</p>}
      <ul className="ha-list">
        {e.tags.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="ha-header">
      <Portrait model={model} className="ha-portrait" />
      <h1 className="ha-name">{model.name || 'Your name'}</h1>
      {model.headline && <p className="ha-headline">{model.headline}</p>}
      {model.contacts.length > 0 && <ContactList contacts={model.contacts} icons />}
      <div className="ha-ornament" aria-hidden="true">
        <span />
      </div>
    </header>
  );
}

const css = `
:root{--aside-w:31%;--gutter:8mm}
.ha-header{display:flex;flex-direction:column;align-items:center;text-align:center;padding-bottom:2mm}
.ha-portrait{width:25mm;height:25mm;border-radius:50%;margin-bottom:3.5mm;box-shadow:0 0 0 2.6pt #fff,0 0 0 3.5pt var(--accent),0 0 0 6pt #fff,0 0 0 6.6pt var(--accent-line)}
.cv-portrait--initials.ha-portrait{background:var(--accent-soft);color:var(--accent);font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:24pt;letter-spacing:.04em}
.ha-name{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:2.7em;line-height:1.08;letter-spacing:.005em;color:var(--ink)}
.ha-headline{margin-top:.5em;font-size:.86em;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
.ha-header .cv-contacts-wrap{margin-top:3mm}
.ha-header .cv-contacts{justify-content:center;margin-left:0;column-gap:1.4em;row-gap:.3em;font-size:.96em;color:var(--ink-2)}
.ha-header .cv-contact{padding-left:0}
.ha-ornament{display:flex;justify-content:center;align-items:center;gap:6pt;margin-top:3.5mm;width:100%}
.ha-ornament::before,.ha-ornament::after{content:'';flex:1;height:.6pt;background:var(--accent-line)}
.ha-ornament span{width:5pt;height:5pt;transform:rotate(45deg);background:var(--accent)}
.cv-top--running{padding-bottom:3mm}
.ha-running{text-align:center;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.1em;color:var(--ink-2);border-bottom:.6pt solid var(--accent-line);padding-bottom:3pt}
.cv-body{flex-direction:row-reverse}
.cv-has-aside .cv-main{padding-left:var(--gutter)}
.cv-has-aside .cv-aside{width:var(--aside-w);padding-right:var(--gutter);border-right:.6pt solid var(--accent-line);font-size:.95em}
.b-heading{padding-top:var(--section-gap);padding-bottom:6pt}
.ha-h{font-family:var(--font-body);font-size:.82em;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);padding-bottom:3pt;border-bottom:.6pt solid var(--accent-line)}
.b-entry{padding-top:var(--item-gap)}
.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:5pt}
.b-skills{padding-top:3pt}
.b-compact.b-first,.b-skills.b-first{padding-top:1pt}
.ha-row{display:flex;justify-content:space-between;align-items:baseline;gap:.9em}
.ha-title{font-family:var(--font-heading);word-spacing:.08em;font-weight:var(--heading-weight);font-size:1.18em;line-height:1.2;color:var(--ink)}
.ha-dates{flex:none;font-size:.9em;color:var(--ink-2);white-space:nowrap;font-variant-numeric:tabular-nums}
.ha-sub{margin-top:.08em;font-size:.97em}
.ha-org{color:var(--accent);font-weight:600}
.ha-meta,.ha-dot{color:var(--ink-3)}
.ha-entry-head{padding-bottom:2.5pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li+li{margin-top:1.6pt}
.ha-summary{color:var(--ink-2);font-size:1.03em}
.ha-lang{display:flex;justify-content:space-between;gap:.6em}
.ha-strong{font-weight:600;color:var(--ink)}
.ha-cred{line-height:1.3}
.ha-muted{color:var(--ink-3);text-align:right}
.ha-small{text-align:left;font-size:.96em;margin-top:1pt;color:var(--ink-2)}
.ha-skill-label{font-weight:600;margin-bottom:2pt}
.ha-list li{position:relative;padding:1.2pt 0 1.2pt 1em;color:var(--ink-2)}
.ha-list li::before{content:'';position:absolute;left:.1em;top:calc(var(--lh) * 0.5em - .12em);width:.32em;height:.32em;transform:rotate(45deg);background:var(--accent)}
`;

export const halo: CatalogueTemplate = {
  id: 'halo',
  name: 'Halo',
  description:
    'A centred portrait in a fine double ring, a graceful name and a calm two-column layout. Warm and personal.',
  style: 'Warm portrait',
  tags: ['Photo', 'Centred', 'Two columns'],
  photo: 'optional',
  support: {
    headerAlign: ['center'],
    skillStyle: ['inline'],
    defaults: { headerAlign: 'center', skillStyle: 'inline', fontPair: 'humanist' },
  },
  asideKinds: ['skills', 'languages', 'certifications', 'licences', 'awards'],
  css,
  hooks,
  Header,
  Running: ({ model }) => <p className="ha-running">{model.name}</p>,
};
