import {
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Sprout — friendly and fresh. A soft rounded header card with a portrait, rounded date chips
 * and pill skills. Approachable for first jobs, students, hospitality and care work.
 */

const hooks: TemplateHooks = {
  heading: (s) => (
    <h2 className="s-h">
      <span className="s-mark" aria-hidden="true" />
      {s.title}
    </h2>
  ),
  summary: (t) => <p className="s-summary">{t}</p>,
  entryHead: (e) => (
    <div className="s-entry-head">
      <div className="s-row">
        <h3 className="s-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="s-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="s-sub">
          {e.title && e.subtitle && <span className="s-org">{e.subtitle}</span>}
          {e.title && e.subtitle && e.meta && <span className="s-dot"> · </span>}
          {e.meta && <span className="s-meta">{e.meta}</span>}
        </p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <p>
        <span className="s-strong">{e.title}</span>
        {e.label && <span className="s-muted"> · {e.label}</span>}
      </p>
    ) : (
      <div className="s-row">
        <p>
          <span className="s-strong">{e.title}</span>
          {joinParts([e.subtitle, e.meta]) && (
            <span className="s-muted"> · {joinParts([e.subtitle, e.meta])}</span>
          )}
        </p>
        {e.dates && <span className="s-dates">{e.dates}</span>}
      </div>
    ),
  skills: (e) => (
    <div>
      {e.label && <p className="s-skill-label">{e.label}</p>}
      <ul className="s-tags">
        {e.tags.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="s-header">
      <div className="s-card">
        <Portrait model={model} className="s-portrait" />
        <div className="s-id">
          <h1 className="s-name">{model.name || 'Your name'}</h1>
          {model.headline && <p className="s-headline">{model.headline}</p>}
          {model.contacts.length > 0 && <ContactList contacts={model.contacts} icons />}
        </div>
      </div>
    </header>
  );
}

const css = `
.s-header{padding-bottom:1mm}
.s-card{position:relative;overflow:hidden;display:flex;align-items:center;gap:7mm;padding:7mm 8mm;border-radius:5mm;background:linear-gradient(120deg,var(--accent-soft) 0%,var(--accent-tint) 70%)}
.s-card::before{content:'';position:absolute;left:-10mm;bottom:-18mm;width:34mm;height:34mm;border-radius:50%;background:var(--accent);opacity:.07}
.s-card::after{content:'';position:absolute;right:-12mm;top:-18mm;width:52mm;height:52mm;border-radius:50%;border:7mm solid var(--accent);opacity:.07}
.s-portrait{width:30mm;height:30mm;border-radius:50%;border:2.6pt solid #fff;box-shadow:0 2pt 8pt rgba(0,0,0,.08)}
.cv-portrait--initials.s-portrait{background:var(--accent);color:#fff;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:24pt}
.s-id{position:relative;z-index:1;min-width:0;flex:1}
.s-name{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:2.8em;line-height:1.05;color:var(--accent-deep);letter-spacing:-.01em}
.s-headline{margin-top:.25em;font-size:1.15em;font-weight:700;color:var(--accent)}
.s-header .cv-contacts-wrap{margin-top:3.5mm}
.s-header .cv-contacts{column-gap:0;row-gap:.35em;font-size:.92em;color:var(--ink-2)}
.s-header .cv-contact{padding-right:1.2em}
.cv-top--running{padding-bottom:3mm}
.s-running{display:flex;justify-content:space-between;align-items:center;padding:2.5mm 4mm;border-radius:3mm;background:var(--accent-tint);font-size:.85em;color:var(--ink-3)}
.s-running strong{font-family:var(--font-heading);font-weight:var(--heading-weight);color:var(--accent-deep);font-size:1.15em}
.b-heading{padding-top:var(--section-gap);padding-bottom:6pt}
.s-h{display:flex;align-items:center;gap:.55em;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.22em;color:var(--ink)}
.s-mark{width:8pt;height:8pt;border-radius:50%;background:var(--accent);flex:none;margin:0 2pt;box-shadow:0 0 0 3pt var(--accent-soft)}
.b-entry{padding-top:var(--item-gap)}
.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:4pt}
.b-skills{padding-top:4pt}
.b-compact.b-first,.b-skills.b-first{padding-top:1pt}
.cv-main [data-block]:not(.b-heading){padding-left:calc(8pt + .55em + 4pt)}
.cv-has-aside .cv-main{padding-right:7mm}
.cv-has-aside .cv-aside{width:31%;margin-top:var(--section-gap);padding:0 5mm 5mm;border-radius:4mm;background:var(--accent-tint);font-size:.95em}
.cv-has-aside .cv-page--rest .cv-aside{margin-top:0}
.cv-aside .s-h{font-size:1.1em}
.cv-aside .s-row{display:block}
.cv-aside .s-row .s-dates{display:inline-block;margin-top:1pt;background:#fff}
.cv-aside .s-tags li{background:#fff}
.s-row{display:flex;justify-content:space-between;align-items:baseline;gap:.9em}
.s-title{font-family:var(--font-body);font-size:1.07em;font-weight:700;color:var(--ink)}
.s-dates{flex:none;font-size:.82em;font-weight:600;color:var(--accent-deep);background:var(--accent-tint);border-radius:10pt;padding:.5pt 7pt;white-space:nowrap;font-variant-numeric:tabular-nums}
.s-sub{margin-top:.08em;font-size:.97em}
.s-org{font-weight:600;color:var(--accent)}
.s-meta,.s-dot{color:var(--ink-3)}
.s-entry-head{padding-bottom:2.5pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li::before{width:.36em;height:.36em}
.cv-bullets li+li{margin-top:1.6pt}
.s-summary{color:var(--ink-2);font-size:1.03em}
.s-strong{font-weight:600;color:var(--ink)}
.s-muted{color:var(--ink-3)}
.s-skill-label{font-weight:600;margin-bottom:3pt}
.s-tags{display:flex;flex-wrap:wrap;gap:4pt}
.s-tags li{padding:2pt 8pt;border-radius:12pt;background:var(--accent-soft);color:var(--accent-deep);font-weight:500;font-size:.93em;line-height:1.35}
`;

export const sprout: TemplateDefinition = {
  id: 'sprout',
  name: 'Sprout',
  description:
    'Friendly and fresh: a soft rounded header with your photo, rounded date chips and pill-shaped skills.',
  style: 'Friendly & fresh',
  tags: ['Photo', 'Rounded', 'First jobs'],
  photo: 'optional',
  support: {
    headerAlign: ['left'],
    skillStyle: ['tags'],
    defaults: { headerAlign: 'left', skillStyle: 'tags', fontPair: 'humanist' },
  },
  asideKinds: ['skills', 'languages', 'certifications', 'licences', 'awards'],
  css,
  hooks,
  Header,
  Running: ({ model }) => (
    <div className="s-running">
      <strong>{model.name}</strong>
      <span>{model.headline}</span>
    </div>
  ),
};
