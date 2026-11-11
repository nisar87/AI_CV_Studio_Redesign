import {
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Meridian — confident header band, main column for experience and a tinted side column
 * for skills, languages and credentials. Side column follows the main column in reading order.
 */

const hooks: TemplateHooks = {
  heading: (s) => <h2 className="m-h">{s.title}</h2>,
  summary: (t) => <p className="m-summary">{t}</p>,
  entryHead: (e) => (
    <div className="m-entry-head">
      <div className="m-row">
        <h3 className="m-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="m-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="m-sub">
          {e.title && e.subtitle && <span className="m-org">{e.subtitle}</span>}
          {e.title && e.subtitle && e.meta && <span className="m-dot"> · </span>}
          {e.meta && <span className="m-meta">{e.meta}</span>}
        </p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <p className="m-lang">
        <strong>{e.title}</strong>
        {e.label && <span>{e.label}</span>}
      </p>
    ) : (
      <div className="m-cred">
        <p className="m-cred-title">{e.title}</p>
        {joinParts([e.subtitle, e.meta, e.dates], ' · ') && (
          <p className="m-cred-sub">{joinParts([e.subtitle, e.meta, e.dates], ' · ')}</p>
        )}
      </div>
    ),
  skills: (e, d) => (
    <div className="m-skills">
      {e.label && <p className="m-skill-label">{e.label}</p>}
      {d.skillStyle === 'tags' ? (
        <ul className="m-tags">
          {e.tags.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="m-skills-inline">{e.tags.join(' · ')}</p>
      )}
    </div>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="m-header">
      <div className="m-id">
        <h1 className="m-name">{model.name || 'Your name'}</h1>
        {model.headline && <p className="m-headline">{model.headline}</p>}
        {model.contacts.length > 0 && <ContactList contacts={model.contacts} separator="|" />}
      </div>
      <Portrait model={model} className="m-portrait" fallback="none" />
    </header>
  );
}

const css = `
:root{--aside-w:31%;--gutter:7mm}
.cv-top--header{margin:calc(-1 * var(--margin)) calc(-1 * var(--margin)) 0;position:relative;z-index:1}
.m-header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8mm;background:linear-gradient(100deg,var(--accent-deep),var(--accent));color:#fff;padding:calc(var(--margin) * 0.8) var(--margin) calc(var(--margin) * 0.6 + 5mm);clip-path:polygon(0 0,100% 0,100% calc(100% - 5mm),0 100%)}
.cv-page--wide::before{display:none}
.m-id{min-width:0;flex:1}
.m-portrait{width:26mm;height:26mm;border-radius:50%;border:2.4pt solid rgba(255,255,255,.9)}
.m-name{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:2.6em;line-height:1.06;letter-spacing:-.01em}
.m-headline{margin-top:.28em;font-size:1.16em;font-weight:500;opacity:.92}
.m-header .cv-contacts{margin-top:.7em;font-size:.97em;color:rgba(255,255,255,.9)}
.m-header .cv-sep{color:rgba(255,255,255,.45)}
.m-header .cv-contacts-wrap{overflow:hidden}
.cv-top--running{padding-bottom:4pt}
.cv-has-aside .m-running{max-width:calc(69% - var(--gutter))}
.m-running{font-family:var(--font-heading);font-weight:var(--heading-weight);color:var(--accent);font-size:1.05em}
.m-running span{font-family:var(--font-body);font-weight:400;color:var(--ink-3);font-size:.85em;margin-left:.6em}
.cv-has-aside .cv-page::before{content:'';position:absolute;top:0;bottom:0;right:0;
  width:calc((var(--page-w) - 2 * var(--margin)) * 0.31 + var(--margin));background:var(--accent-tint)}
.cv-has-aside .cv-aside{position:relative;width:var(--aside-w);padding-left:var(--gutter)}
.cv-has-aside .cv-main{padding-right:var(--gutter)}
.cv-main,.cv-aside{position:relative}
.b-heading{padding-top:var(--section-gap);padding-bottom:5pt}
.m-h{font-family:var(--font-body);font-size:.86em;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--accent)}
.m-h::after{content:'';display:block;width:16pt;height:2pt;margin-top:3pt;background:var(--accent);border-radius:1pt}
.cv-aside .m-h{font-size:.8em}
.b-entry{padding-top:var(--item-gap)}
.b-entry.b-first,.b-summary.b-first,.b-skills.b-first,.b-compact.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:5pt}
.b-skills{padding-top:5pt}
.m-row{display:flex;justify-content:space-between;align-items:baseline;gap:.9em}
.m-title{font-family:var(--font-body);font-size:1.05em;font-weight:700;color:var(--ink)}
.m-dates{flex:none;font-size:.88em;color:var(--ink-3);white-space:nowrap;font-variant-numeric:tabular-nums}
.m-sub{font-size:.96em;margin-top:.05em}
.m-org{color:var(--accent);font-weight:600}
.m-meta,.m-dot{color:var(--ink-3)}
.m-entry-head{padding-bottom:2.5pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li+li{margin-top:1.5pt}
.m-summary{color:var(--ink-2)}
.cv-aside{font-size:.95em}
.m-lang{display:flex;justify-content:space-between;gap:.6em}
.m-lang strong{font-weight:600;flex:none;max-width:55%}
.m-lang span{color:var(--ink-3);text-align:right;min-width:0}
.m-cred-title{font-weight:600;color:var(--ink);line-height:1.3}
.m-cred-sub{color:var(--ink-3);font-size:.94em;margin-top:1pt}
.m-skill-label{font-weight:600;margin-bottom:3pt;color:var(--ink)}
.m-tags{display:flex;flex-wrap:wrap;gap:3.5pt}
.m-tags li{padding:1.6pt 6pt;border-radius:3pt;background:#fff;box-shadow:0 0 0 .5pt var(--accent-line);color:var(--ink);font-size:.93em;line-height:1.35}
.m-skills-inline{color:var(--ink-2)}
`;

export const meridian: TemplateDefinition = {
  id: 'meridian',
  name: 'Meridian',
  description:
    'Bold coloured header with a side column for skills and qualifications. Confident and well organised.',
  style: 'Bold & organised',
  support: {
    headerAlign: ['left'],
    skillStyle: ['tags', 'inline'],
    defaults: { headerAlign: 'left', skillStyle: 'tags' },
  },
  photo: 'optional',
  tags: ['Side column', 'Colour header', 'Photo'],
  asideKinds: ['skills', 'languages', 'certifications', 'licences', 'awards'],
  css,
  hooks,
  Header,
  Running: ({ model }) => (
    <p className="m-running">
      {model.name}
      {model.headline && <span>{model.headline}</span>}
    </p>
  ),
};
