import { ContactList, joinParts, type TemplateComponentProps, type TemplateHooks } from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Clarity — single column, calm and highly readable. The default for most people.
 * Accent rule at the top of every page, small-caps section titles with a hairline.
 */

const hooks: TemplateHooks = {
  heading: (s) => (
    <h2 className="c-h">
      <span>{s.title}</span>
    </h2>
  ),
  summary: (t) => <p className="c-summary">{t}</p>,
  entryHead: (e) => (
    <div className="c-entry-head">
      <div className="c-row">
        <h3 className="c-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="c-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="c-sub">{joinParts([e.title ? e.subtitle : '', e.meta], ' · ')}</p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <p className="c-compact">
        <strong>{e.title}</strong>
        {e.label && <span className="c-muted"> — {e.label}</span>}
      </p>
    ) : (
      <div className="c-row c-compact">
        <p>
          <strong>{e.title}</strong>
          {joinParts([e.subtitle, e.meta]) && (
            <span className="c-muted"> — {joinParts([e.subtitle, e.meta])}</span>
          )}
        </p>
        {e.dates && <span className="c-dates">{e.dates}</span>}
      </div>
    ),
  skills: (e, d) =>
    d.skillStyle === 'tags' ? (
      <div className="c-skills">
        {e.label && <p className="c-skill-label">{e.label}</p>}
        <ul className="c-tags">
          {e.tags.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    ) : (
      <p className="c-skills-inline">
        {e.label && <strong>{e.label}: </strong>}
        {e.tags.join(' · ')}
      </p>
    ),
};

function Header({ model, design }: TemplateComponentProps) {
  return (
    <header className={`c-header c-header--${design.headerAlign}`}>
      <h1 className="c-name">{model.name || 'Your name'}</h1>
      {model.headline && <p className="c-headline">{model.headline}</p>}
      {model.contacts.length > 0 && <ContactList contacts={model.contacts} separator="·" />}
    </header>
  );
}

const css = `
.cv-page::before{content:'';position:absolute;left:0;right:0;top:0;height:5pt;background:var(--accent)}
.c-header{padding-bottom:4pt}
.c-header--center{text-align:center}
.c-header--center .cv-contacts{justify-content:center;margin-left:0}
.c-header--center .cv-contact:first-child{padding-left:0}
.c-header--center .cv-contact:first-child .cv-sep{display:none}
.c-name{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:2.55em;line-height:1.08;letter-spacing:-.012em;color:var(--ink)}
.c-headline{margin-top:.3em;font-size:1.18em;font-weight:600;color:var(--accent);letter-spacing:.005em}
.c-header .cv-contacts{margin-top:.75em;font-size:.93em;color:var(--ink-2)}
.cv-top--running{padding-bottom:2pt}
.c-running{display:flex;justify-content:space-between;font-size:.82em;color:var(--ink-3);letter-spacing:.04em}
.c-running strong{font-family:var(--font-heading);font-weight:var(--heading-weight);color:var(--ink-2);letter-spacing:0}
.b-heading{padding-top:var(--section-gap);padding-bottom:5pt}
.c-h{display:flex;align-items:center;gap:.7em;font-family:var(--font-body);font-size:.84em;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--accent)}
.c-h::after{content:'';flex:1;height:.75pt;background:var(--accent-line)}
.b-entry{padding-top:var(--item-gap)}
.b-entry.b-first,.b-summary.b-first,.b-skills.b-first,.b-compact.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:3pt}
.b-skills{padding-top:4pt}
.c-row{display:flex;justify-content:space-between;align-items:baseline;gap:1em}
.c-title{font-size:1.06em;font-weight:700;color:var(--ink);font-family:var(--font-body)}
.c-dates{flex:none;font-size:.9em;color:var(--ink-3);font-variant-numeric:tabular-nums;white-space:nowrap}
.c-sub{color:var(--ink-2);font-size:.96em;margin-top:.05em}
.c-entry-head{padding-bottom:2.5pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li+li{margin-top:1.5pt}
.c-summary{color:var(--ink-2)}
.c-muted{color:var(--ink-3)}
.c-compact strong{font-weight:600;color:var(--ink)}
.c-skills-inline{color:var(--ink-2)}
.c-skills-inline strong{color:var(--ink);font-weight:600}
.c-skill-label{font-weight:600;margin-bottom:3pt}
.c-tags{display:flex;flex-wrap:wrap;gap:4pt}
.c-tags li{padding:1.5pt 6pt;border-radius:3pt;background:var(--accent-soft);color:var(--ink);font-size:.92em}
`;

export const clarity: TemplateDefinition = {
  id: 'clarity',
  name: 'Clarity',
  description: 'Single column with a clean accent line. Calm, clear and easy for anyone to read.',
  style: 'Modern & clear',
  support: {
    headerAlign: ['left', 'center'],
    skillStyle: ['inline', 'tags'],
    defaults: { headerAlign: 'left', skillStyle: 'inline' },
  },
  asideKinds: [],
  css,
  hooks,
  Header,
  Running: ({ model }) => (
    <div className="c-running">
      <strong>{model.name}</strong>
      <span>{model.headline}</span>
    </div>
  ),
};
