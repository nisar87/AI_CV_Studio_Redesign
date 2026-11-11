import {
  SubMeta,
  ContactList,
  joinParts,
  Portrait,
  type TemplateComponentProps,
  type TemplateHooks,
} from '../blocks';
import type { TemplateDefinition } from '../types';

/**
 * Heritage — centred serif masthead, ruled small-caps section titles, generous whitespace.
 * Understated and senior; suits executives and traditional professions.
 */

const hooks: TemplateHooks = {
  heading: (s) => (
    <h2 className="h-h">
      <span>{s.title}</span>
    </h2>
  ),
  summary: (t) => <p className="h-summary">{t}</p>,
  entryHead: (e) => (
    <div className="h-entry-head">
      <div className="h-row">
        <h3 className="h-title">{e.title || e.subtitle}</h3>
        {e.dates && <span className="h-dates">{e.dates}</span>}
      </div>
      {(e.title ? e.subtitle : '') || e.meta ? (
        <p className="h-sub">
          <SubMeta e={e} sep=", " />
        </p>
      ) : null}
    </div>
  ),
  compactItem: (e, s) =>
    s.kind === 'languages' ? (
      <p>
        <span className="h-strong">{e.title}</span>
        {e.label && <span className="h-muted"> — {e.label}</span>}
      </p>
    ) : (
      <div className="h-row">
        <p>
          <span className="h-strong">{e.title}</span>
          {joinParts([e.subtitle, e.meta]) && (
            <span className="h-muted">, {joinParts([e.subtitle, e.meta])}</span>
          )}
        </p>
        {e.dates && <span className="h-dates">{e.dates}</span>}
      </div>
    ),
  skills: (e) => (
    <p className="h-skills">
      {e.label && <span className="h-strong">{e.label}: </span>}
      {e.tags.join('  ·  ')}
    </p>
  ),
};

function Header({ model }: TemplateComponentProps) {
  return (
    <header className="h-header">
      <Portrait model={{ ...model, photo: '' }} className="h-monogram" />
      <h1 className="h-name">{model.name || 'Your name'}</h1>
      {model.headline && <p className="h-headline">{model.headline}</p>}
      {model.contacts.length > 0 && <ContactList contacts={model.contacts} separator="•" />}
    </header>
  );
}

const css = `
.h-monogram{width:13mm;height:13mm;margin:0 auto 3.5mm;border-radius:50%;border:.8pt solid var(--accent);box-shadow:0 0 0 2pt #fff,0 0 0 2.6pt var(--accent-line);color:var(--accent);font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:13pt;letter-spacing:.06em}
.h-header{text-align:center;padding-bottom:6pt;border-bottom:.75pt solid var(--accent-line);margin-bottom:2pt}
.h-name{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:3.1em;line-height:1.05;letter-spacing:.015em;color:var(--ink)}
.h-headline{margin-top:.45em;font-size:.88em;letter-spacing:.24em;text-transform:uppercase;color:var(--accent);font-weight:600}
.h-header .cv-contact:first-child{padding-left:0}
.h-header .cv-contact:first-child .cv-sep{display:none}
.h-header .cv-contacts{justify-content:center;margin-left:0;margin-top:.9em;font-size:.97em;color:var(--ink-2)}
.h-header .cv-sep{color:var(--accent-line)}
.cv-top--running{padding-bottom:4pt}
.h-running{text-align:center;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.1em;letter-spacing:.04em;color:var(--ink-2);border-bottom:.5pt solid var(--accent-line);padding-bottom:4pt}
.b-heading{padding-top:calc(var(--section-gap) * 1.1);padding-bottom:6pt}
.h-h{display:flex;align-items:center;gap:.9em;font-family:var(--font-body);font-size:.8em;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
.h-h::before,.h-h::after{content:'';flex:1;height:.5pt;background:var(--accent-line)}
.b-entry{padding-top:var(--item-gap)}
.b-entry.b-first,.b-summary.b-first,.b-skills.b-first,.b-compact.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:3pt}
.b-skills{padding-top:3pt}
.h-row{display:flex;justify-content:space-between;align-items:baseline;gap:1em}
.h-title{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.3em;line-height:1.2;color:var(--ink)}
.h-dates{flex:none;font-size:.86em;letter-spacing:.06em;color:var(--ink-3);white-space:nowrap;font-variant-numeric:tabular-nums}
.h-sub{font-style:italic;color:var(--ink-2);margin-top:.05em}
.h-entry-head{padding-bottom:3pt}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li+li{margin-top:2pt}
.cv-bullets li::before{border-radius:0;transform:rotate(45deg);width:.28em;height:.28em}
.h-summary{color:var(--ink-2);font-size:1.03em}
.h-strong{font-weight:600;color:var(--ink)}
.h-muted{color:var(--ink-3)}
.h-skills{color:var(--ink-2);text-align:center;text-wrap:balance}
`;

export const heritage: TemplateDefinition = {
  id: 'heritage',
  name: 'Heritage',
  description:
    'Centred, elegant serif layout with fine rules and generous space. Understated and senior.',
  style: 'Calm & classic',
  support: {
    headerAlign: ['center'],
    skillStyle: ['inline'],
    defaults: { headerAlign: 'center', skillStyle: 'inline' },
  },
  photo: 'none',
  tags: ['Serif', 'Senior roles', 'Traditional'],
  asideKinds: [],
  css,
  hooks,
  Header,
  Running: ({ model }) => <p className="h-running">{model.name}</p>,
};
