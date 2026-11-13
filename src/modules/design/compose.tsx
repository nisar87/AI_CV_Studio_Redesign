import type { ReactNode } from 'react';
import {
  Award,
  BadgeCheck,
  Briefcase,
  FolderKanban,
  GraduationCap,
  HandHeart,
  IdCard,
  Languages,
  ListChecks,
  UserRound,
  Wrench,
} from 'lucide-react';
import { create as createQr } from 'qrcode';
import type { SectionKind } from '@/modules/resume/schema';
import {
  ContactList,
  joinParts,
  Portrait,
  SubMeta,
  classes,
  type TemplateComponentProps,
  type TemplateHooks,
} from '@/modules/templates/blocks';
import { ensureContrast, mix } from '@/modules/templates/color';
import { PAGE_DIMENSIONS, type ResolvedDesign } from '@/modules/templates/design';
import { FONT_PAIRS } from '@/modules/templates/fonts';
import type { REntry, RenderModel, RSection } from '@/modules/templates/render-model';
import type { TemplateDefinition } from '@/modules/templates/types';
import type { DesignSpecV2 } from './spec';

/**
 * The composer (complete-studio-spec §7.5): Design Spec v2 → the TemplateDefinition the engine
 * already consumes (CSS, render hooks, header, running header, side columns, decoration), so
 * pagination, preview, PDF and the parity tests are unchanged. Every CSS value comes from an
 * enum or a clamped number; person-written text only ever appears as escaped HTML text.
 */

const INK: Record<DesignSpecV2['color']['ink'], [string, string, string]> = {
  black: ['#111317', '#33373d', '#5d636b'],
  charcoal: ['#1b1e23', '#41464e', '#686e77'],
  navy: ['#15233b', '#33415a', '#5c677b'],
};

export function resolveSpec(s: DesignSpecV2): ResolvedDesign {
  const raw = s.color.mode === 'mono' ? INK[s.color.ink][1] : s.color.accent;
  // Accent text also sits on cream paper and on tinted side columns (down to the 90% white
  // "soft" tint): 5.2:1 against white keeps it at 4.5:1 or more on all of them.
  const accent = ensureContrast(raw, '#ffffff', 5.2);
  const skill = s.lists.skills.style;
  return {
    templateId: s.baseId ?? 'clarity',
    pageSize: s.page.size,
    page: PAGE_DIMENSIONS[s.page.size],
    accent,
    accentSoft: mix(accent, '#ffffff', 0.9),
    accentTint: mix(accent, '#ffffff', 0.955),
    accentLine: mix(accent, '#ffffff', 0.6),
    accentDeep: mix(accent, '#000000', 0.22),
    accentBright: mix(accent, '#ffffff', 0.72),
    font: FONT_PAIRS[s.type.pair],
    fontPairId: s.type.pair,
    density: {
      bodyPt: s.type.basePt,
      lineHeight: s.type.lineHeight,
      marginMm: s.page.marginMm,
      sectionGapPt: s.spacing.sectionGapPt,
      itemGapPt: s.spacing.itemGapPt,
    },
    headerAlign: s.header.align,
    skillStyle: skill === 'inline' || skill === 'grouped-list' ? 'inline' : 'tags',
  };
}

// ---------------------------------------------------------------- small pieces

const SECTION_ICON: Partial<Record<SectionKind | 'summary', typeof Briefcase>> = {
  experience: Briefcase,
  volunteering: HandHeart,
  education: GraduationCap,
  skills: Wrench,
  languages: Languages,
  certifications: BadgeCheck,
  licences: IdCard,
  awards: Award,
  projects: FolderKanban,
  custom: ListChecks,
  summary: UserRound,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Reformat "Mar 2021 – Present" (English dates from render-model) to the chosen style. */
export function formatDates(dates: string, f: DesignSpecV2['entries']['dateFormat']): string {
  if (f === 'MMM YYYY' || !dates) return dates;
  return dates.replace(/\b([A-Z][a-z]{2})[a-z]*\.? (\d{4})\b/g, (m, mon: string, y: string) => {
    const i = MONTHS.indexOf(mon);
    if (i < 0) return m;
    return f === 'YYYY' ? y : `${String(i + 1).padStart(2, '0')}/${y}`;
  });
}

function Name({ model, s }: { model: RenderModel; s: DesignSpecV2 }) {
  const name = model.name || 'Your name';
  if (s.header.name.twoTone && model.firstName && model.lastName)
    return (
      <h1 className="g-name">
        {model.firstName} <span className="g-name-2">{model.lastName}</span>
      </h1>
    );
  return <h1 className="g-name">{name}</h1>;
}

function Contacts({ model, s, inSide }: { model: RenderModel; s: DesignSpecV2; inSide?: boolean }) {
  if (!model.contacts.length) return null;
  const layout = inSide ? 'stacked' : s.header.contact.layout;
  return (
    <div className={`g-contacts g-contacts--${layout}`}>
      <ContactList
        contacts={model.contacts}
        icons={s.header.contact.icons}
        stacked={layout !== 'inline'}
        separator={s.header.contact.icons ? undefined : '·'}
      />
    </div>
  );
}

function Photo({ model, s }: { model: RenderModel; s: DesignSpecV2 }) {
  if (!s.header.photo.show) return null;
  return (
    <Portrait
      model={model}
      className={`g-photo g-photo--${s.header.photo.shape} g-photo--${s.header.photo.size}`}
      fallback={s.header.style === 'monogram' ? 'initials' : 'none'}
    />
  );
}

function QrCode({ text }: { text: string }) {
  const qr = createQr(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const cells: ReactNode[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(x, y))
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
  return (
    <svg
      className="g-qr"
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <g fill="#000">{cells}</g>
    </svg>
  );
}

// ---------------------------------------------------------------- hooks

function makeHooks(s: DesignSpecV2): TemplateHooks {
  const leadOrg = (sec: RSection) =>
    s.entries.lead === 'organisation' && (sec.kind === 'experience' || sec.kind === 'volunteering');
  const Icon = ({ kind }: { kind: RSection['kind'] }) => {
    const I = SECTION_ICON[kind as SectionKind];
    return I ? (
      <I
        className="g-h-icon"
        aria-hidden="true"
        strokeWidth={s.icons.style === 'solid' ? 2.6 : 1.8}
      />
    ) : null;
  };
  return {
    splitSkills: s.lists.skills.style === 'tags' || s.lists.skills.style === 'columns',
    heading: (sec) => (
      <h2 className="g-h">
        {(s.headings.style === 'icon' || s.icons.sections) && <Icon kind={sec.kind} />}
        <span className="g-h-text">{sec.title}</span>
      </h2>
    ),
    ...(s.layout.type === 'label-column'
      ? { label: (sec: RSection) => <p className="g-label">{sec.title}</p> }
      : {}),
    summary: (t) => <p className="g-summary">{t}</p>,
    entryHead: (e, sec) => {
      const org = leadOrg(sec) && e.title && e.subtitle;
      const title = org ? e.subtitle : e.title || e.subtitle;
      const sub = org ? ({ ...e, subtitle: e.title } as REntry) : e;
      const dates = formatDates(e.dates, s.entries.dateFormat);
      const hasSub = (e.title ? e.subtitle : '') || e.meta;
      return (
        <div className={`g-entry g-entry--${s.entries.layout}`}>
          {dates && s.entries.layout !== 'dates-right' && s.entries.layout !== 'stacked' && (
            <p className="g-when">{dates}</p>
          )}
          <div className="g-what">
            <div className="g-row">
              <h3 className="g-title">{title}</h3>
              {dates && s.entries.layout === 'dates-right' && (
                <span className="g-dates">{dates}</span>
              )}
            </div>
            {hasSub ? (
              <p className="g-sub">
                <SubMeta e={sub} sep=" · " />
              </p>
            ) : null}
            {dates && s.entries.layout === 'stacked' && (
              <p className="g-dates g-dates--below">{dates}</p>
            )}
          </div>
        </div>
      );
    },
    compactItem: (e, sec) =>
      sec.kind === 'languages' ? (
        <div className="g-compact g-lang">
          <p>
            <strong>{e.title}</strong>
            {e.label && <span className="g-muted"> {e.label}</span>}
          </p>
          {s.lists.languages.style !== 'text' && !!e.level && (
            <Meter value={e.level} kind={s.lists.languages.style} label={e.title} />
          )}
        </div>
      ) : (
        <div className="g-compact">
          <p>
            <strong>{e.title}</strong>
            {joinParts([e.subtitle, e.meta]) && (
              <span className="g-muted"> — {joinParts([e.subtitle, e.meta])}</span>
            )}
          </p>
          {e.dates && <span className="g-dates">{formatDates(e.dates, s.entries.dateFormat)}</span>}
        </div>
      ),
    skills: (e) => {
      const style = s.lists.skills.style;
      // Bars and dots only show levels the person gave; without levels they fall back to tags.
      if ((style === 'bars' || style === 'dots') && e.levels)
        return (
          <div className="g-skills g-skills--levels">
            {e.label && <p className="g-skill-label">{e.label}</p>}
            <ul className="g-levels">
              {e.tags.map((t, i) => (
                <li key={i}>
                  <span>{t}</span>
                  {!!e.levels![i] && <Meter value={e.levels![i]!} kind={style} label={t} />}
                </li>
              ))}
            </ul>
          </div>
        );
      if (style === 'inline')
        return (
          <p className="g-skills-inline">
            {e.label && <strong>{e.label}: </strong>}
            {e.tags.join(' · ')}
          </p>
        );
      return (
        <div className={`g-skills g-skills--${style}`}>
          {e.label && <p className="g-skill-label">{e.label}</p>}
          <ul className={style === 'tags' ? 'g-tags' : 'g-list'}>
            {e.tags.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      );
    },
  };
}

/** A level from 1 to 5 as a bar or five dots; the number is in the text for screen readers and ATS. */
function Meter({ value, kind, label }: { value: number; kind: 'bars' | 'dots'; label: string }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className={`g-meter g-meter--${kind}`} role="img" aria-label={`${label}: ${v} of 5`}>
      {kind === 'bars' ? (
        <span className="g-bar">
          <span style={{ width: `${v * 20}%` }} />
        </span>
      ) : (
        [1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= v ? 'on' : ''} />)
      )}
    </span>
  );
}

// ---------------------------------------------------------------- header

function Header({ model, s }: { model: RenderModel; s: DesignSpecV2 }) {
  const H = s.header;
  const photoInHeader = H.photo.position !== 'side-top';
  const contactsHere = s.placement.contactIn !== 'side';
  const id = (
    <div className="g-id">
      {H.style === 'monogram' && !model.photo && model.initials && (
        <div className="g-mono" aria-hidden="true">
          {model.initials}
        </div>
      )}
      <Name model={model} s={s} />
      {H.headline !== 'hidden' && model.headline && <p className="g-headline">{model.headline}</p>}
      {contactsHere && H.style !== 'split' && <Contacts model={model} s={s} />}
    </div>
  );
  return (
    <header
      className={classes(
        'g-header',
        `g-header--${H.style}`,
        `g-band--${H.band}`,
        `g-align--${H.align}`,
        `g-photo-at--${H.photo.position}`,
      )}
    >
      {H.style === 'in-sidebar' && <div className="g-side-cap" aria-hidden="true" />}
      <div className="g-hrow">
        {photoInHeader && H.photo.position !== 'header-right' && <Photo model={model} s={s} />}
        {id}
        {H.style === 'split' && contactsHere && (
          <div className="g-split-contact">
            <Contacts
              model={model}
              s={{ ...s, header: { ...H, contact: { ...H.contact, layout: 'stacked' } } }}
            />
          </div>
        )}
        {photoInHeader && H.photo.position === 'header-right' && <Photo model={model} s={s} />}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- CSS

const NAME_EM = { S: 2.1, M: 2.5, L: 2.85, XL: 3.35 } as const;
const H_EM = { S: 0.84, M: 0.94, L: 1.08 } as const;
const PHOTO_MM = { S: 20, M: 25, L: 31 } as const;
const MARKER: Record<DesignSpecV2['bullets']['marker'], string> = {
  disc: "content:'';width:.32em;height:.32em;border-radius:50%;background:var(--bullet)",
  square: "content:'';width:.3em;height:.3em;background:var(--bullet)",
  diamond: "content:'';width:.3em;height:.3em;background:var(--bullet);transform:rotate(45deg)",
  dash: "content:'';width:.55em;height:.11em;background:var(--bullet);top:calc(var(--lh) * .5em - .05em)",
  // Drawn shapes, not text glyphs: a glyph missing from the CV fonts would make Chrome embed a
  // fallback font as Type 3 in the PDF.
  arrow:
    "content:'';width:0;height:0;background:none;border-left:.42em solid var(--bullet);border-top:.25em solid transparent;border-bottom:.25em solid transparent;top:calc(var(--lh) * .5em - .25em)",
  chevron:
    "content:'';width:.3em;height:.3em;background:none;border-top:.12em solid var(--bullet);border-right:.12em solid var(--bullet);transform:rotate(45deg);top:calc(var(--lh) * .5em - .2em);left:.05em",
  check:
    "content:'';width:.24em;height:.46em;background:none;border-bottom:.13em solid var(--bullet);border-right:.13em solid var(--bullet);transform:rotate(45deg);top:calc(var(--lh) * .5em - .34em);left:.2em",
  none: 'content:none',
};

function css(s: DesignSpecV2, d: ResolvedDesign): string {
  const L = s.layout;
  const ink = INK[s.color.ink];
  const second =
    s.color.mode === 'duo' && s.color.secondary
      ? ensureContrast(s.color.secondary, '#ffffff', 5.2)
      : d.accent;
  const sideLeft = L.type === 'sidebar-left' || L.type === 'rails';
  const fill =
    L.sideFill === 'none'
      ? 'transparent'
      : L.sideFill === 'tint'
        ? 'var(--accent-tint)'
        : L.sideFill === 'solid'
          ? 'var(--accent-soft)'
          : 'var(--accent-deep)';
  const deep = L.sideFill === 'deep';
  const bg =
    s.page.background === 'cream'
      ? '#fbf8f1'
      : s.page.background === 'tint'
        ? d.accentTint
        : '#ffffff';
  const hColor = s.headings.color === 'accent' ? 'var(--accent)' : 'var(--ink)';
  const caseCss = (c: DesignSpecV2['headings']['case']) =>
    c === 'upper'
      ? // Kept modest: wider tracking splits words in PDF text extraction ("WO R K").
        'text-transform:uppercase;letter-spacing:.06em'
      : c === 'small-caps'
        ? // Drawn as smaller capitals: Chrome's synthetic small caps split words in PDF text
          // extraction ("W ork history"), which screening software could misread.
          'text-transform:uppercase;letter-spacing:.06em'
        : '';
  /** Small capitals are capitals at 90% size. */
  const capK = (c: DesignSpecV2['headings']['case']) => (c === 'small-caps' ? 0.9 : 1);
  const out: string[] = [];
  out.push(
    `:root{--ink:${ink[0]};--ink-2:${ink[1]};--ink-3:${ink[2]};--second:${second};--bullet:${s.bullets.color === 'accent' ? 'var(--accent)' : 'var(--ink-2)'};--side-w:${L.sideWidthPct}%;--gap:${L.gapMm}mm}`,
  );
  out.push(`.cv-page{background:${bg}}`);
  if (!s.furniture.pageNumbers) out.push('.cv-foot{display:none}');

  // Layout
  if (
    L.type === 'sidebar-left' ||
    L.type === 'sidebar-right' ||
    L.type === 'two-equal' ||
    L.type === 'rails'
  ) {
    const third = L.type === 'rails';
    out.push(`.cv-has-aside .cv-aside{width:var(--side-w);order:${sideLeft ? -1 : 1};font-size:.95em;position:relative;
  padding-${sideLeft ? 'right' : 'left'}:var(--gap)}
.cv-has-aside .cv-main{position:relative}
.cv-has-third .cv-third{width:var(--side-w);order:2;font-size:.95em;padding-left:var(--gap);position:relative}`);
    if (fill !== 'transparent') {
      // The fill ends 3 mm before the column's text, so it never touches the main column.
      const w = `calc((var(--page-w) - 2 * var(--margin)) * ${L.sideWidthPct / 100} - var(--gap) + 3mm + ${L.sideBleed ? 'var(--margin)' : '0mm'})`;
      const pos = sideLeft
        ? `left:${L.sideBleed ? '0' : 'var(--margin)'}`
        : `right:${L.sideBleed ? '0' : 'var(--margin)'}`;
      out.push(`.cv-has-aside .cv-page:not(.cv-page--wide)::before{content:'';position:absolute;top:0;bottom:0;${pos};width:${w};background:${fill};z-index:0}
.cv-has-aside .cv-aside{padding-${sideLeft ? 'left' : 'right'}:${L.sideBleed ? '0' : '3mm'};padding-top:2mm}`);
      if (third)
        out.push(`.cv-has-third .cv-page:not(.cv-page--wide)::after{content:'';position:absolute;top:0;bottom:0;right:${L.sideBleed ? '0' : 'var(--margin)'};width:${w};background:${fill};z-index:0}
.cv-has-third .cv-third{padding-right:${L.sideBleed ? '0' : '3mm'};padding-top:2mm}`);
      if (L.sideFill === 'solid') out.push('.cv-aside,.cv-third{--ink-3:var(--ink-2)}');
      // The page number sits bottom right: on a deep right-hand column it is drawn light.
      if (deep && L.type !== 'sidebar-left')
        out.push('.cv-has-aside .cv-page:not(.cv-page--wide) .cv-foot{color:rgba(255,255,255,.8)}');
      if (deep)
        out.push(`.cv-aside,.cv-third{color:#fff;--ink:#fff;--ink-2:rgba(255,255,255,.88);--ink-3:rgba(255,255,255,.72);--accent:var(--accent-bright);--bullet:var(--accent-bright)}
.cv-aside .g-tags li,.cv-third .g-tags li{background:rgba(255,255,255,.14);color:#fff}`);
    }
  }
  if (L.type === 'timeline')
    out.push(`.cv-main{padding-left:5mm;border-left:.8pt solid var(--accent-line)}
.cv-main .b-heading .g-h{margin-left:-5mm}
.cv-main .b-entry .g-what{position:relative}
.cv-main .b-entry .g-what::before{content:'';position:absolute;left:calc(-5mm - 3pt);top:.45em;width:5.2pt;height:5.2pt;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2pt ${bg}}`);
  if (L.type === 'label-column')
    out.push(`.b-labelled{display:flex;gap:var(--gap)}
.b-label{flex:none;width:23%}
.b-content{flex:1;min-width:0}
.cv-main [data-block]:not(.b-heading){padding-left:calc(23% + var(--gap))}
.cv-main [data-block]:has(> .b-labelled){padding-left:0}
.cv-main .b-heading{height:0;padding:0;overflow:hidden;position:absolute}
.g-label{font-size:${(H_EM[s.headings.size] * 0.92 * capK(s.headings.case)).toFixed(3)}em;font-weight:${s.headings.weight};color:${hColor};${caseCss(s.headings.case)};padding-top:.15em}`);

  // Header
  const H = s.header;
  const nameCase =
    H.name.case === 'upper'
      ? 'text-transform:uppercase'
      : H.name.case === 'small-caps'
        ? 'text-transform:uppercase'
        : '';
  out.push(`.g-header{position:relative;padding-bottom:4pt}
.g-hrow{display:flex;align-items:center;gap:6mm}
.g-id{flex:1;min-width:0}
.g-name{font-family:var(--font-heading);font-weight:${H.name.weight};font-size:${(NAME_EM[H.name.size] * capK(H.name.case)).toFixed(3)}em;line-height:1.08;letter-spacing:${H.name.trackingEm}em;color:var(--ink);${nameCase}}
.g-name-2{color:var(--accent)}
.g-headline{margin-top:.3em;font-size:1.15em;font-weight:600;color:var(--accent)}
.g-contacts{margin-top:.75em;font-size:.93em;color:var(--ink-2)}
.g-contacts--grid-2 .cv-contacts{display:grid;grid-template-columns:1fr 1fr;column-gap:1.2em;margin-left:0}
.g-contacts--grid-2 .cv-contact{padding-left:0}
.g-header .cv-contact{padding-right:1.1em}
.g-photo{width:${PHOTO_MM[H.photo.size]}mm;height:${PHOTO_MM[H.photo.size]}mm;border-radius:${H.photo.shape === 'circle' ? '50%' : H.photo.shape === 'rounded' ? '5pt' : '0'};${H.photo.ring ? 'box-shadow:0 0 0 2.2pt #fff,0 0 0 3.4pt var(--accent);' : ''}}
.g-align--center{text-align:center}
.g-align--center .g-hrow{flex-direction:column}
.g-align--center .g-photo,.g-header--centered .g-photo,.g-header--monogram .g-photo{order:-1}
.g-align--center .cv-contacts{justify-content:center;margin-left:0}
.g-align--center .cv-contact:first-child{padding-left:0}
.g-mono{display:inline-flex;width:15mm;height:15mm;margin-bottom:3mm;border-radius:50%;border:1.2pt solid var(--accent);align-items:center;justify-content:center;font-family:var(--font-heading);font-size:1.25em;color:var(--accent);letter-spacing:.04em}
.g-portrait-initials,.cv-portrait--initials{background:var(--accent-soft);color:var(--accent);font-family:var(--font-heading);font-size:1.6em}`);
  if (H.style === 'centered')
    out.push(
      '.g-header--centered{text-align:center}.g-header--centered .g-hrow{flex-direction:column}.g-header--centered .cv-contacts{justify-content:center;margin-left:0}.g-header--centered .cv-contact:first-child{padding-left:0}',
    );
  if (H.style === 'band' || H.style === 'in-sidebar') {
    const bandBg =
      H.band === 'gradient'
        ? 'linear-gradient(120deg,var(--accent-deep),var(--accent))'
        : 'var(--accent-deep)';
    const clip =
      H.band === 'angled'
        ? 'clip-path:polygon(0 0,100% 0,100% 82%,0 100%);padding-bottom:calc(var(--margin) * .9 + 4mm);'
        : 'padding-bottom:calc(var(--margin) * .6);';
    out.push(`.cv-top--header{margin:calc(-1 * var(--margin)) calc(-1 * var(--margin)) 4mm}
.g-header--band,.g-header--in-sidebar{background:${bandBg};${clip}padding-top:var(--margin);padding-left:var(--margin);padding-right:var(--margin);color:#fff}
.g-header--band .g-name,.g-header--in-sidebar .g-name{color:#fff}
.g-header--band .g-name-2,.g-header--in-sidebar .g-name-2{color:var(--accent-bright)}
.g-header--band .g-headline,.g-header--in-sidebar .g-headline{color:rgba(255,255,255,.94)}
.g-header--band .g-contacts,.g-header--in-sidebar .g-contacts{color:rgba(255,255,255,.9)}
.g-header--band .cv-icon,.g-header--in-sidebar .cv-icon{color:var(--accent-bright)}
.g-header--band .cv-sep,.g-header--in-sidebar .cv-sep{color:rgba(255,255,255,.5)}
.g-photo-at--overlap .g-photo{margin-bottom:-12mm;box-shadow:0 0 0 2.4pt #fff}`);
  }
  if (H.style === 'split')
    out.push(
      '.g-split-contact{flex:none;max-width:40%;font-size:.92em}.g-header--split .g-contacts{margin-top:0}.g-header--split{border-bottom:.8pt solid var(--accent-line);padding-bottom:5pt}',
    );
  if (H.style === 'card')
    out.push('.g-header--card{background:var(--accent-tint);border-radius:8pt;padding:5mm 6mm}');
  if (H.style === 'monogram')
    out.push(
      '.g-header--monogram{text-align:center}.g-header--monogram .g-hrow{flex-direction:column}.g-header--monogram .cv-contacts{justify-content:center;margin-left:0}.g-header--monogram .cv-contact:first-child{padding-left:0}',
    );
  out.push(`.g-running{display:flex;justify-content:space-between;font-size:.82em;color:var(--ink-3)}
.g-running strong{font-family:var(--font-heading);color:var(--ink-2)}
.cv-top--running{padding-bottom:3pt}`);

  // Section headings
  out.push(`.b-heading{padding-top:var(--section-gap);padding-bottom:5pt}
.g-h{display:flex;align-items:center;gap:.5em;font-family:var(--font-body);font-size:${(H_EM[s.headings.size] * capK(s.headings.case)).toFixed(3)}em;font-weight:${s.headings.weight};color:${hColor};${caseCss(s.headings.case)}}
.g-h-icon{width:1.15em;height:1.15em;flex:none;color:var(--accent)}`);
  const hs = s.headings.style;
  if (hs === 'underline')
    out.push('.g-h{padding-bottom:3pt;border-bottom:.9pt solid var(--accent-line)}');
  if (hs === 'overline') out.push('.g-h{padding-top:4pt;border-top:1.4pt solid var(--accent)}');
  if (hs === 'rule-after')
    out.push(".g-h::after{content:'';flex:1;height:.75pt;background:var(--accent-line)}");
  if (hs === 'bar-left') out.push('.g-h{border-left:3pt solid var(--accent);padding-left:6pt}');
  if (hs === 'filled')
    out.push(
      '.g-h{background:var(--accent);color:#fff;padding:2.5pt 7pt;border-radius:2pt}.g-h .g-h-icon{color:#fff}',
    );
  if (hs === 'boxed')
    out.push(
      '.g-h{border:.9pt solid var(--accent-line);padding:2pt 7pt;border-radius:3pt;display:inline-flex}',
    );
  if (hs === 'numbered')
    out.push(
      '[data-cv-pages]{counter-reset:sec}.cv-main .g-h{counter-increment:sec}.cv-main .g-h::before{content:counter(sec,decimal-leading-zero);color:var(--accent);font-variant-numeric:tabular-nums;margin-right:.2em}',
    );
  // Duo colour: the second colour is the heading text, or the fill behind white heading text.
  if (s.color.mode === 'duo')
    out.push(hs === 'filled' ? '.g-h{background:var(--second)}' : '.g-h{color:var(--second)}');

  // Section containers and dividers (per block: blocks are paginated independently)
  const sc = s.sections;
  if (sc.container === 'card')
    out.push(
      '.cv-main [data-block]{background:var(--accent-tint);padding-left:4mm;padding-right:4mm}.cv-main .b-heading{border-radius:5pt 5pt 0 0}',
    );
  if (sc.container === 'outlined')
    out.push(
      '.cv-main [data-block]{border-left:.8pt solid var(--accent-line);border-right:.8pt solid var(--accent-line);padding-left:4mm;padding-right:4mm}.cv-main .b-heading{border-top:.8pt solid var(--accent-line)}',
    );
  // A tinted heading strip always has dark text (it replaces a "filled" heading's white text).
  if (sc.container === 'tinted-heading')
    out.push(
      `.g-h{background:var(--accent-tint);padding:2.5pt 6pt;color:${hs === 'filled' ? 'var(--accent-deep)' : hColor}}.g-h .g-h-icon{color:var(--accent)}`,
    );
  if (sc.divider === 'line')
    out.push(
      '.cv-main .b-heading:not(:first-child){border-top:.6pt solid var(--rule);margin-top:4pt}',
    );
  if (sc.divider === 'dotted')
    out.push(
      '.cv-main .b-heading:not(:first-child){border-top:1pt dotted var(--rule);margin-top:4pt}',
    );
  if (sc.divider === 'accent-line')
    out.push(
      '.cv-main .b-heading:not(:first-child){border-top:1pt solid var(--accent-line);margin-top:4pt}',
    );
  if (sc.divider === 'space') out.push('.b-heading{padding-top:calc(var(--section-gap) * 1.35)}');

  // Entries
  out.push(`.b-entry{padding-top:var(--item-gap)}
.b-entry.b-first,.b-summary.b-first,.b-skills.b-first,.b-compact.b-first{padding-top:1pt}
.b-bullet{padding-top:1.5pt}
.b-compact{padding-top:3pt}
.b-skills{padding-top:4pt}
.g-row{display:flex;justify-content:space-between;align-items:baseline;gap:1em}
.g-title{font-size:1.05em;font-weight:700;color:var(--ink);font-family:var(--font-body)}
.g-dates{flex:none;font-size:.9em;color:var(--ink-3);white-space:nowrap;font-variant-numeric:tabular-nums}
.g-dates--below{display:block;margin-top:.1em}
.g-sub{color:var(--ink-2);font-size:.96em;margin-top:.05em}
.g-entry{padding-bottom:2.5pt}
.g-entry--dates-left,.g-entry--timeline-dots{display:flex;gap:4mm}
.g-entry--dates-left .g-when,.g-entry--timeline-dots .g-when{flex:none;width:21%;font-size:.88em;color:var(--ink-3);padding-top:.12em}
.g-entry--dates-left .g-what,.g-entry--timeline-dots .g-what{flex:1;min-width:0}
.g-entry--timeline-dots .g-what{padding-left:4mm;border-left:.8pt solid var(--accent-line);position:relative}
.g-entry--timeline-dots .g-what::after{content:'';position:absolute;left:-3pt;top:.4em;width:5pt;height:5pt;border-radius:50%;background:var(--accent)}
.cv-bullets{color:var(--ink-2)}
.cv-bullets li+li{margin-top:1.5pt}
.cv-bullets li::before{${MARKER[s.bullets.marker]}}
${s.bullets.marker === 'none' ? '.cv-bullets li{padding-left:0}' : ''}
${s.bullets.marker === 'arrow' ? '.cv-bullets li{padding-left:1.2em}' : ''}
${s.entries.layout === 'dates-left' || s.entries.layout === 'timeline-dots' ? '.b-entry .cv-bullets,.b-bullet .cv-bullets{margin-left:calc(21% + 4mm)}' : ''}
.g-summary{color:var(--ink-2)}
.g-muted{color:var(--ink-3)}
.g-compact{display:flex;justify-content:space-between;align-items:baseline;gap:.8em}
.g-compact strong{font-weight:600;color:var(--ink)}
.g-lang{display:flex;justify-content:space-between;gap:.6em}
.cv-aside .g-compact:not(.g-lang),.cv-third .g-compact:not(.g-lang){display:block}
.cv-aside .g-compact .g-dates,.cv-third .g-compact .g-dates{display:block;white-space:normal}`);

  // Skills
  const cols = s.lists.skills.columns;
  out.push(`.g-skills-inline{color:var(--ink-2)}
.g-skills-inline strong{color:var(--ink);font-weight:600}
.g-skill-label{font-weight:600;margin-bottom:3pt;color:var(--ink)}
.g-tags{display:flex;flex-wrap:wrap;gap:4pt}
.g-tags li{padding:1.5pt 6pt;border-radius:3pt;background:var(--accent-soft);color:var(--ink);font-size:.92em}
.g-skills--columns .g-list{columns:${cols};column-gap:4mm}
.cv-aside .g-skills--columns .g-list,.cv-third .g-skills--columns .g-list{columns:${Math.min(cols, 2)}}
.g-list li{position:relative;padding-left:.9em;break-inside:avoid}
.g-list li::before{content:'';position:absolute;left:.1em;top:calc(var(--lh) * .5em - .1em);width:.26em;height:.26em;border-radius:50%;background:var(--bullet)}
.g-skills--grouped-list .g-list li{padding-left:0}
.g-skills--grouped-list .g-list li::before{content:none}
.g-levels li{display:flex;align-items:center;justify-content:space-between;gap:.6em;break-inside:avoid}
.g-levels li+li{margin-top:2pt}
.g-meter{display:inline-flex;gap:2pt;flex:none;align-items:center}
.g-bar{display:block;width:16mm;height:3pt;border-radius:2pt;background:var(--accent-soft);overflow:hidden}
.g-bar span{display:block;height:100%;background:var(--accent)}
.g-meter--dots span{width:4.5pt;height:4.5pt;border-radius:50%;border:.6pt solid var(--accent)}
.g-meter--dots span.on{background:var(--accent)}
.g-lang{align-items:center}`);

  // Extras and furniture
  out.push(`.g-end{padding-top:var(--section-gap);display:flex;align-items:center;gap:4mm;color:var(--ink-2);font-size:.95em}
.g-qr{width:19mm;height:19mm;flex:none}
.g-aside-photo{padding-bottom:4mm}
.g-aside-photo .g-photo{margin:0 auto}
.g-aside-contact{padding-bottom:3mm}
.g-foot{position:absolute;left:var(--margin);bottom:calc(var(--margin) * .45);font-size:7.5pt;color:var(--ink-3);letter-spacing:.03em}`);

  // Generic decoration (purely visual, never behind text above 8% opacity)
  const a = s.decor.intensity === 'medium' ? 0.08 : 0.05;
  const k = s.decor.kind;
  if (k === 'top-bar')
    out.push(
      '.g-decor-top{position:absolute;left:0;right:0;top:0;height:3mm;background:var(--accent)}',
    );
  if (k === 'side-stripe')
    out.push(
      `.g-decor-stripe{position:absolute;top:0;bottom:0;${sideLeft ? 'right' : 'left'}:0;width:2.2mm;background:var(--accent)}`,
    );
  if (k === 'corner-shapes')
    out.push(`.g-decor-c1{position:absolute;right:-18mm;top:-18mm;width:55mm;height:55mm;border-radius:50%;background:var(--accent);opacity:${a * 2}}
.g-decor-c2{position:absolute;left:-14mm;bottom:-14mm;width:40mm;height:40mm;background:var(--accent);opacity:${a * 1.5};transform:rotate(20deg)}`);
  if (k === 'frame')
    out.push(
      '.g-decor-frame{position:absolute;inset:5mm;border:.8pt solid var(--accent-line);border-radius:3pt}',
    );
  if (k === 'dot-grid')
    out.push(
      `.g-decor-dots{position:absolute;right:6mm;top:6mm;width:34mm;height:24mm;opacity:${a * 3};background-image:radial-gradient(var(--accent) 1pt,transparent 1.2pt);background-size:4mm 4mm}`,
    );
  if (k === 'watermark-initials')
    out.push(
      `.g-decor-wm{position:absolute;right:8mm;bottom:12mm;font-family:var(--font-heading);font-size:110pt;line-height:1;color:var(--accent);opacity:${a};font-weight:700}`,
    );
  return out.join('\n');
}

// ---------------------------------------------------------------- composer

/**
 * Design Spec v2 (already normalised) → TemplateDefinition. Attached catalogue specs are not
 * composed here (they use their signature code; see design/render.ts).
 */
export function composeTemplate(s: DesignSpecV2): TemplateDefinition {
  const d = resolveSpec(s);
  const side = s.placement.side as SectionKind[];
  const third = s.layout.type === 'rails' ? (s.placement.third as SectionKind[]) : [];
  const hasSideColumn = side.length + third.length > 0 || s.placement.contactIn === 'side';
  const sidePhoto = s.header.photo.show && s.header.photo.position === 'side-top';
  const k = s.decor.kind;
  const needsDecor = (k !== 'none' && !k.startsWith('signature:')) || s.furniture.footer !== 'none';
  return {
    id: 'custom',
    name: 'My design',
    description: 'A design made from your own choices.',
    style: 'Custom',
    support: {
      headerAlign: ['left', 'center'],
      skillStyle: ['tags', 'inline'],
      defaults: { headerAlign: s.header.align, skillStyle: d.skillStyle, fontPair: s.type.pair },
    },
    photo: s.header.photo.show ? 'optional' : 'none',
    tags: [],
    asideKinds: side,
    thirdKinds: third,
    keepColumns: s.layout.continuation === 'keep-columns',
    contactsIn: s.placement.contactIn === 'side' && hasSideColumn ? 'aside' : 'header',
    AsideContact:
      s.placement.contactIn === 'side'
        ? ({ model }) => (
            <div className="g-aside-contact">
              <Contacts model={model} s={s} inSide />
            </div>
          )
        : undefined,
    AsideTop: sidePhoto
      ? ({ model }) =>
          model.photo ? (
            <div className="g-aside-photo">
              <Photo model={model} s={s} />
            </div>
          ) : null
      : undefined,
    MainEnd:
      s.extras.referencesLine || s.extras.qr !== 'none'
        ? ({ model }) => {
            const url = qrTarget(model, s.extras.qr);
            if (!s.extras.referencesLine && !url) return null;
            return (
              <div className="g-end">
                {url && <QrCode text={url} />}
                {s.extras.referencesLine && <p>References available on request.</p>}
              </div>
            );
          }
        : undefined,
    Decor: needsDecor
      ? ({ model }) => (
          <>
            {k === 'top-bar' && <div className="g-decor-top" />}
            {k === 'side-stripe' && <div className="g-decor-stripe" />}
            {k === 'corner-shapes' && (
              <>
                <div className="g-decor-c1" />
                <div className="g-decor-c2" />
              </>
            )}
            {k === 'frame' && <div className="g-decor-frame" />}
            {k === 'dot-grid' && <div className="g-decor-dots" />}
            {k === 'watermark-initials' && model.initials && (
              <div className="g-decor-wm">{model.initials}</div>
            )}
            {s.furniture.footer !== 'none' && (
              <div className="g-foot">
                {s.furniture.footer === 'name'
                  ? model.name
                  : joinParts(
                      model.contacts.slice(0, 2).map((c) => c.text),
                      ' · ',
                    )}
              </div>
            )}
          </>
        )
      : undefined,
    css: css(s, d),
    hooks: makeHooks(s),
    Header: ({ model }: TemplateComponentProps) => <Header model={model} s={s} />,
    Running: s.furniture.runningHeader
      ? ({ model }) => (
          <div className="g-running">
            <strong>{model.name}</strong>
            <span>{model.headline}</span>
          </div>
        )
      : undefined,
  };
}

/** The link a QR code points to: the portfolio page or LinkedIn, from the person's own links. */
function qrTarget(model: RenderModel, which: DesignSpecV2['extras']['qr']): string | null {
  if (which === 'none') return null;
  const links = model.contacts.filter((c) => c.kind === 'link' && c.href?.startsWith('https://'));
  const hit =
    which === 'linkedin'
      ? links.find((c) => /linkedin\.com/i.test(c.href!))
      : (links.find((c) => /aicvstudio\.app\/p\//i.test(c.href!)) ??
        links.find((c) => !/linkedin\.com/i.test(c.href!)));
  return hit?.href ?? null;
}

/**
 * Every text/background colour pair the composer can draw for a spec (catalogue gate §8.3,
 * "contrast on resolved colours"). Kept next to `css()`, which it mirrors.
 */
export function contrastPairs(spec: DesignSpecV2): { what: string; fg: string; bg: string }[] {
  const s = spec;
  const d = resolveSpec(s);
  const ink = INK[s.color.ink];
  const page =
    s.page.background === 'cream'
      ? '#fbf8f1'
      : s.page.background === 'tint'
        ? d.accentTint
        : '#ffffff';
  /** `fg` at `alpha` opacity over `bg`. */
  const over = (fg: string, alpha: number, bg: string) => mix(bg, fg, alpha);
  const second =
    s.color.mode === 'duo' && s.color.secondary
      ? ensureContrast(s.color.secondary, '#ffffff', 5.2)
      : d.accent;
  const heading =
    s.color.mode === 'duo' ? second : s.headings.color === 'accent' ? d.accent : ink[0];
  const out: { what: string; fg: string; bg: string }[] = [];
  const add = (what: string, fg: string, bg: string) => out.push({ what, fg, bg });
  for (const [i, c] of ink.entries()) add(`ink-${i + 1} on page`, c, page);
  add('accent text on page', d.accent, page);
  add('tag text', ink[0], d.accentSoft);
  const hs = s.headings.style;
  const sc = s.sections.container;
  if (sc === 'tinted-heading')
    add('heading on tinted strip', hs === 'filled' ? d.accentDeep : heading, d.accentTint);
  else if (hs === 'filled')
    add('filled heading', '#ffffff', s.color.mode === 'duo' ? second : d.accent);
  else add('heading on page', heading, page);
  if (sc === 'card')
    for (const [i, c] of ink.entries()) add(`ink-${i + 1} in card`, c, d.accentTint);
  if (s.header.style === 'band' || s.header.style === 'in-sidebar') {
    const bands = s.header.band === 'gradient' ? [d.accentDeep, d.accent] : [d.accentDeep];
    for (const b of bands) {
      add('name on band', '#ffffff', b);
      add('headline on band', over('#ffffff', 0.94, b), b);
      add('contacts on band', over('#ffffff', 0.9, b), b);
    }
  }
  if (s.header.style === 'card') add('name on header card', ink[0], d.accentTint);
  const L = s.layout;
  const side = ['sidebar-left', 'sidebar-right', 'two-equal', 'rails'].includes(L.type);
  if (side && L.sideFill !== 'none') {
    if (L.sideFill === 'deep') {
      const b = d.accentDeep;
      add('side text', '#ffffff', b);
      add('side text 2', over('#ffffff', 0.88, b), b);
      add('side muted', over('#ffffff', 0.72, b), b);
      add('side accent', d.accentBright, b);
      add('side tags', '#ffffff', over('#ffffff', 0.14, b));
      if (L.type !== 'sidebar-left') add('page number on side', over('#ffffff', 0.8, b), b);
    } else {
      const b = L.sideFill === 'solid' ? d.accentSoft : d.accentTint;
      const sideInk = L.sideFill === 'solid' ? [ink[0], ink[1], ink[1]] : ink;
      for (const [i, c] of sideInk.entries()) add(`side ink-${i + 1}`, c, b);
      add('side heading', heading, b);
    }
  }
  return out;
}
