import {
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Folio — magazine editorial. A split name (light first name, bold coloured surname), a framed
 * portrait with an offset colour block, serif section titles and a quiet side column.
 */

const hooks: TemplateHooks = {
  heading: (s) => (
    <h2 className="f-h">
      {s.title}
      <span className="f-stop" aria-hidden="true">
        .
      </span>
    </h2>
  ),
  summary: (t) => <p className="f-summary">{t}</p>,
  entryHead: (e) => (
    <div className="f-entry-head">
      <div className="f-row">
        <h3 className="f-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="f-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="f-sub">{joinParts([e.title ? e.subtitle : '', e.meta], ', ')}</p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <div className="f-lang">
        <span className="f-strong">{e.title}</span>
        {e.label && <span className="f-muted">{e.label}</span>}
      </div>
    ) : (
      <div>
        <p className="f-strong f-cred">{e.title}</p>
        {joinParts([e.subtitle, e.meta, e.dates], ', ') && (
          <p className="f-muted f-small">{joinParts([e.subtitle, e.meta, e.dates], ', ')}</p>
        )}
      </div>
    ),
  skills: (e) => (
    <div className="f-skills">
      {e.label && <p className="f-skill-label">{e.label}</p>}
      <ul>
        {e.tags.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="f-header">
      <div className="f-id">
        <h1 className="f-name">
          <span className="f-first">{model.firstName || 'Your name'}</span>
          {model.lastName && <span className="f-last">{model.lastName}</span>}
        </h1>
        {model.headline && (
          <p className="f-headline">
            <span>{model.headline}</span>
          </p>
        )}
      </div>
      {model.photo && (
        <div className="f-frame">
          <Portrait model={model} className="f-portrait" fallback="none" />
        </div>
      )}
    </header>
  );
}

const css = `
:root{--aside-w:30%;--gutter:8mm}
.f-header{display:flex;align-items:flex-end;justify-content:space-between;gap:9mm;padding-bottom:7mm}
.f-id{min-width:0;flex:1}
.f-name{font-family:var(--font-heading);font-size:3.4em;line-height:.98;letter-spacing:-.02em;color:var(--ink)}
.f-name span{display:block}
.f-first{font-weight:400}
.f-last{font-weight:700;color:var(--accent)}
.f-headline{display:flex;align-items:center;gap:.8em;margin-top:.8em;font-size:.86em;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-2)}
.f-headline::after{content:'';flex:1;height:.6pt;background:var(--ink-3)}
.f-frame{position:relative;flex:none;margin:0 3mm 3mm 0}
.f-frame::before{content:'';position:absolute;left:3mm;top:3mm;right:-3mm;bottom:-3mm;background:var(--accent)}
.f-portrait{position:relative;width:30mm;height:37mm}
.cv-top--running{padding-bottom:4mm}
.f-running{display:flex;justify-content:space-between;align-items:baseline;font-size:.85em;color:var(--ink-3)}
.f-running strong{font-family:var(--font-heading);font-size:1.25em;font-weight:400;color:var(--ink)}
.f-running strong b{color:var(--accent);font-weight:700}
.cv-has-aside .cv-main{padding-right:var(--gutter)}
.cv-has-aside .cv-aside{width:var(--aside-w);padding-left:var(--gutter);border-left:.6pt solid var(--ink-3);font-size:.94em}
.b-heading{padding-top:var(--section-gap);padding-bottom:6pt}
.f-h{font-family:var(--font-heading);font-weight:600;font-size:1.42em;letter-spacing:-.01em;color:var(--ink);line-height:1.15}
.f-stop{color:var(--accent);font-weight:800}
.cv-aside .f-h{font-size:1.18em}
.b-contact .cv-contacts{row-gap:.5em}
.b-contact .cv-icon{color:var(--accent)}
.b-contact .cv-contact-label{color:var(--ink-3)}
.b-entry{padding-top:var(--item-gap)}
.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:4.5pt}
.b-skills{padding-top:3pt}
.b-compact.b-first,.b-skills.b-first{padding-top:1pt}
.f-row{display:flex;justify-content:space-between;align-items:baseline;gap:.9em}
.f-title{font-family:var(--font-heading);font-weight:650;font-size:1.2em;line-height:1.2;color:var(--ink)}
.f-dates{flex:none;font-size:.82em;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);white-space:nowrap;font-variant-numeric:tabular-nums}
.f-sub{margin-top:.1em;color:var(--accent);font-style:italic}
.f-entry-head{padding-bottom:3pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li::before{border-radius:0;width:.42em;height:.08em;top:calc(var(--lh) * 0.5em);background:var(--accent)}
.cv-bullets li+li{margin-top:1.6pt}
.f-summary{font-family:var(--font-heading);font-size:1.08em;line-height:1.5;color:var(--ink)}
.f-lang{display:flex;justify-content:space-between;gap:.6em}
.f-strong{font-weight:600;color:var(--ink)}
.f-cred{line-height:1.3}
.f-muted{color:var(--ink-3);text-align:right}
.f-small{text-align:left;font-size:.94em;margin-top:1pt}
.f-skill-label{font-weight:600;margin-bottom:2pt;color:var(--ink)}
.f-skills li{color:var(--ink-2);padding:.6pt 0}
`;

export const folio: TemplateDefinition = {
  id: 'folio',
  name: 'Folio',
  description:
    'Magazine-style: a striking two-tone name, framed photo, serif headings and a quiet side column.',
  style: 'Editorial',
  tags: ['Photo', 'Serif', 'Magazine'],
  photo: 'optional',
  contactsIn: 'aside',
  support: {
    headerAlign: ['left'],
    skillStyle: ['inline'],
    defaults: { headerAlign: 'left', skillStyle: 'inline', fontPair: 'classic' },
  },
  asideKinds: ['skills', 'languages', 'certifications', 'licences', 'awards'],
  css,
  hooks,
  Header,
  AsideContact: ({ model }) => (
    <>
      <h2 className="f-h">
        Contact
        <span className="f-stop" aria-hidden="true">
          .
        </span>
      </h2>
      <div style={{ height: '6pt' }} />
      <ContactList contacts={model.contacts} icons stacked />
    </>
  ),
  Running: ({ model }) => (
    <div className="f-running">
      <strong>
        {model.firstName} <b>{model.lastName}</b>
      </strong>
      <span>{model.headline}</span>
    </div>
  ),
};
