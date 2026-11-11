import {
  MetaText,
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Vivid — a bold colour band with soft geometric art and a portrait that overlaps its edge.
 * Pill section labels and a light side column keep the energy high and the reading easy.
 */

const hooks: TemplateHooks = {
  splitSkills: true,
  heading: (s) => (
    <h2 className="v-h">
      <span>{s.title}</span>
    </h2>
  ),
  summary: (t) => <p className="v-summary">{t}</p>,
  entryHead: (e) => (
    <div className="v-entry-head">
      <div className="v-row">
        <h3 className="v-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="v-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="v-sub">
          {e.title && e.subtitle && <span className="v-org">{e.subtitle}</span>}
          {e.title && e.subtitle && e.meta && <span className="v-dot"> · </span>}
          {e.meta && (
            <span className="v-meta">
              <MetaText e={e} />
            </span>
          )}
        </p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <div className="v-lang">
        <span className="v-strong">{e.title}</span>
        {e.label && <span className="v-muted">{e.label}</span>}
      </div>
    ) : (
      <div>
        <p className="v-strong v-cred">{e.title}</p>
        {joinParts([e.subtitle, e.meta, e.dates], ' · ') && (
          <p className="v-muted v-small">{joinParts([e.subtitle, e.meta, e.dates], ' · ')}</p>
        )}
      </div>
    ),
  skills: (e) => (
    <div>
      {e.label && <p className="v-skill-label">{e.label}</p>}
      <ul className="v-tags">
        {e.tags.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="v-header">
      <div className="v-band">
        <svg
          className="v-art"
          viewBox="0 0 400 200"
          preserveAspectRatio="xMaxYMid slice"
          aria-hidden="true"
        >
          <circle cx="330" cy="40" r="120" fill="#fff" fillOpacity="0.07" />
          <circle
            cx="250"
            cy="200"
            r="70"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.16"
            strokeWidth="1.5"
          />
          <circle cx="395" cy="170" r="55" fill="#fff" fillOpacity="0.06" />
          <g fill="#fff" fillOpacity="0.22">
            {Array.from({ length: 20 }, (_, i) => (
              <circle key={i} cx={176 + (i % 5) * 11} cy={34 + Math.floor(i / 5) * 11} r="1.6" />
            ))}
          </g>
        </svg>
        <div className="v-id">
          <h1 className="v-name">{model.name || 'Your name'}</h1>
          {model.headline && <p className="v-headline">{model.headline}</p>}
        </div>
      </div>
      <Portrait model={model} className="v-portrait" />
      {model.contacts.length > 0 && (
        <div className="v-contacts">
          <ContactList contacts={model.contacts} icons />
        </div>
      )}
    </header>
  );
}

const css = `
:root{--aside-w:31%;--gutter:8mm;--photo:37mm}
.cv-top--header{margin:calc(-1 * var(--margin)) calc(-1 * var(--margin)) 0}
.v-header{position:relative;padding-bottom:4mm}
.v-band{position:relative;overflow:hidden;background:linear-gradient(115deg,var(--accent-deep) 0%,var(--accent) 100%);color:#fff;
  padding:calc(var(--margin) * 1.05) calc(var(--margin) + var(--photo) + 8mm) calc(var(--margin) * 0.95) var(--margin);min-height:46mm;display:flex;align-items:center}
.v-art{position:absolute;right:0;top:0;height:100%;width:62%}
.v-id{position:relative;min-width:0}
.v-name{font-family:var(--font-heading);font-weight:800;font-size:3em;line-height:1.02;letter-spacing:-.025em}
.v-headline{margin-top:.4em;font-size:1.15em;font-weight:500;color:rgba(255,255,255,.88)}
.v-portrait{position:absolute;right:var(--margin);top:calc(46mm - var(--photo) * 0.62);width:var(--photo);height:var(--photo);border-radius:50%;border:3.2pt solid #fff;box-shadow:0 3pt 10pt rgba(0,0,0,.18);background:var(--accent-soft)}
.cv-portrait--initials.v-portrait{color:var(--accent);font-family:var(--font-heading);font-weight:800;font-size:27pt;letter-spacing:-.01em}
.v-contacts{padding:4.5mm calc(var(--margin) + var(--photo) + 6mm) 0 var(--margin);min-height:calc(var(--photo) * 0.38 + 2mm)}
.v-contacts .cv-contacts{column-gap:0;row-gap:.35em;font-size:.97em;color:var(--ink-2)}
.v-contacts .cv-contact{padding-right:1.3em}
html[data-photo="0"] .v-portrait:not(.cv-portrait--initials){display:none}
.cv-page--rest::before{content:'';position:absolute;left:0;right:0;top:0;height:5pt;background:linear-gradient(90deg,var(--accent-deep),var(--accent))}
.cv-top--running{padding-bottom:3mm}
.v-running{display:flex;justify-content:space-between;align-items:baseline;font-size:.85em;color:var(--ink-3)}
.v-running strong{font-family:var(--font-heading);font-weight:800;color:var(--ink);font-size:1.15em;letter-spacing:-.01em}
.cv-has-aside .cv-main{padding-right:var(--gutter)}
.cv-has-aside .cv-aside{width:var(--aside-w);padding-left:var(--gutter);border-left:.6pt solid var(--rule)}
.b-heading{padding-top:var(--section-gap);padding-bottom:6.5pt}
.v-h span{display:inline-block;padding:2.2pt 9pt 2pt;border-radius:20pt;background:var(--accent-soft);color:var(--accent-deep);font-family:var(--font-body);font-size:.8em;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.b-entry{padding-top:var(--item-gap)}
.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:5pt}
.b-skills{padding-top:4pt}
.b-compact.b-first,.b-skills.b-first{padding-top:1pt}
.v-row{display:flex;justify-content:space-between;align-items:baseline;gap:.9em}
.v-title{font-family:var(--font-body);font-size:1.08em;font-weight:700;color:var(--ink)}
.v-dates{flex:none;font-size:.85em;font-weight:600;color:var(--accent);white-space:nowrap;font-variant-numeric:tabular-nums}
.v-sub{margin-top:.06em;font-size:.97em}
.v-org{font-weight:600;color:var(--ink-2)}
.v-meta,.v-dot{color:var(--ink-3)}
.v-entry-head{padding-bottom:2.5pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li+li{margin-top:1.6pt}
.v-summary{color:var(--ink-2);font-size:1.02em}
.cv-aside{font-size:.95em}
.v-lang{display:flex;justify-content:space-between;gap:.6em}
.v-strong{font-weight:600;color:var(--ink)}
.v-cred{line-height:1.3}
.v-muted{color:var(--ink-3);text-align:right}
.v-small{text-align:left;font-size:.94em;margin-top:1pt}
.v-skill-label{font-weight:600;margin-bottom:3pt}
.v-tags{display:flex;flex-wrap:wrap;gap:3.5pt}
.v-tags li{padding:1.8pt 6.5pt;border-radius:10pt;background:var(--accent-soft);color:var(--accent-deep);font-weight:500;font-size:.93em;line-height:1.35}
`;

export const vivid: TemplateDefinition = {
  id: 'vivid',
  name: 'Vivid',
  description:
    'A bold colour band with subtle geometric art and a portrait that overlaps its edge. Energetic and modern.',
  style: 'Bold & modern',
  tags: ['Photo', 'Colour band', 'Modern'],
  photo: 'optional',
  support: {
    headerAlign: ['left'],
    skillStyle: ['tags'],
    defaults: { headerAlign: 'left', skillStyle: 'tags', fontPair: 'modern' },
  },
  asideKinds: ['skills', 'languages', 'certifications', 'licences', 'awards'],
  css,
  hooks,
  Header,
  Running: ({ model }) => (
    <div className="v-running">
      <strong>{model.name}</strong>
      <span>{model.headline}</span>
    </div>
  ),
};
