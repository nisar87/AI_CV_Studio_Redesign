import { cloneElement, type ReactNode } from 'react';
import type { ResolvedDesign } from './design';
import type { Contact, REntry, RenderModel, RSection } from './render-model';

/**
 * Shared building blocks. Templates differ in styling (CSS) and in a few render hooks;
 * block structure (what may break across pages) is the same for all templates.
 */

export type Keep = 'none' | 'with-next' | 'together';

export function Block({
  keep,
  className,
  refId,
  kind,
  children,
}: {
  keep: Keep;
  className: string;
  refId?: string;
  kind?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-block=""
      data-keep={keep}
      className={kind ? `${className} k-${kind}` : className}
      data-ref={refId}
    >
      {children}
    </div>
  );
}

/** Kinds rendered as compact lists rather than dated entries. */
const COMPACT_KINDS = new Set(['certifications', 'licences', 'awards', 'languages']);

export type TemplateHooks = {
  /** Title + subtitle + dates + meta for an entry. */
  entryHead: (e: REntry, section: RSection) => ReactNode;
  /** A compact one-line item (licences, certifications, languages, awards). */
  compactItem: (e: REntry, section: RSection) => ReactNode;
  /** Skills group. */
  skills: (e: REntry, design: ResolvedDesign) => ReactNode;
  heading: (section: RSection) => ReactNode;
  /**
   * Optional label rendered in a side column next to the first block of each section
   * (label-column layouts). It takes real space, so long labels can never overlap.
   */
  label?: (section: RSection) => ReactNode;
  summary: (text: string) => ReactNode;
  /** Skills render one item per tag/line, so big groups may be split across pages at item boundaries. */
  splitSkills?: boolean;
};

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="cv-bullets">
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

const BULLETS_IN_HEAD = 2;
/** Entries with up to this many bullets are never split across pages… */
export const KEEP_WHOLE_ENTRY_MAX_BULLETS = 6;
/**
 * …unless their bullets are long: six two-line bullets are a third of a page, and keeping that
 * whole can push a whole section to the next page and leave half a page empty.
 */
export const KEEP_WHOLE_ENTRY_MAX_CHARS = 600;
/** Skills per chunk when a large group is split across pages. */
const SKILL_CHUNK = 6;

/** Join class names. (Not a template literal: the Tailwind Prettier plugin trims spaces in those.) */
export function classes(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

/**
 * Keep rules for short lists (skills, languages, licences…): lists of up to four items stay
 * together; longer lists may break, but never leave a single item alone on a page.
 */
export function listKeep(i: number, n: number): Keep {
  if (n <= 4) return i < n - 1 ? 'with-next' : 'together';
  return i === 0 || i === n - 2 ? 'with-next' : 'together';
}

/** Convert one section into pagination blocks. */
export function sectionBlocks(
  section: RSection,
  hooks: TemplateHooks,
  design: ResolvedDesign,
): ReactNode[] {
  let out = sectionBlocksRaw(section, hooks, design);
  if (!hooks.label || out.length < 2) return out;
  // Label-column layouts: keep short lists in one block so the label sits beside the whole list.
  const isList = section.kind === 'skills' || COMPACT_KINDS.has(section.kind);
  if (isList && section.entries.length <= 8) {
    const items = out.slice(1) as React.ReactElement<{ children: ReactNode; className: string }>[];
    out = [
      out[0],
      <Block
        kind={section.kind}
        key={`${section.id}-list`}
        keep="together"
        className="b-list b-first"
      >
        {items.map((it, i) => (
          <div key={i} className={it.props.className.replace('b-first', '')}>
            {it.props.children}
          </div>
        ))}
      </Block>,
    ];
  }
  // Wrap the content of the first block after the heading with the section label.
  const first = out[1] as React.ReactElement<{ children: ReactNode }>;
  out[1] = cloneElement(first, {
    children: (
      <div className="b-labelled">
        <div className="b-label">{hooks.label(section)}</div>
        <div className="b-content">{first.props.children}</div>
      </div>
    ),
  });
  return out;
}

function sectionBlocksRaw(
  section: RSection,
  hooks: TemplateHooks,
  design: ResolvedDesign,
): ReactNode[] {
  const out: ReactNode[] = [];
  out.push(
    <Block kind={section.kind} key={`${section.id}-h`} keep="with-next" className="b-heading">
      {hooks.heading(section)}
    </Block>,
  );

  if (section.kind === 'summary') {
    out.push(
      <Block
        kind={section.kind}
        key={`${section.id}-t`}
        keep="together"
        className="b-summary b-first"
        refId="basics/summary"
      >
        {hooks.summary(section.text ?? '')}
      </Block>,
    );
    return out;
  }

  if (section.kind === 'skills' || COMPACT_KINDS.has(section.kind)) {
    const isSkills = section.kind === 'skills';
    // Large skill groups are split into chunks so a page never leaves usable side-column space empty
    // just because one group is long. The label stays with the first chunk.
    const split = isSkills && (hooks.splitSkills || design.skillStyle === 'tags');
    const items: { e: REntry; cont: boolean }[] = [];
    for (const e of section.entries) {
      if (split && e.tags.length > SKILL_CHUNK + 2) {
        for (let k = 0; k < e.tags.length; k += SKILL_CHUNK)
          items.push({
            e: { ...e, label: k === 0 ? e.label : '', tags: e.tags.slice(k, k + SKILL_CHUNK) },
            cont: k > 0,
          });
      } else items.push({ e, cont: false });
    }
    const n = items.length;
    // Split chunks may break between any two chunks (never leaving the last chunk alone).
    const wasSplit = items.some((it) => it.cont);
    items.forEach(({ e, cont }, i) =>
      out.push(
        <Block
          kind={section.kind}
          key={`${e.ref}-${i}`}
          keep={wasSplit ? (i === n - 2 ? 'with-next' : 'together') : listKeep(i, n)}
          className={classes(
            isSkills ? 'b-skills' : 'b-compact',
            i === 0 && 'b-first',
            cont && 'b-cont',
          )}
          refId={e.ref}
        >
          {isSkills ? hooks.skills(e, design) : hooks.compactItem(e, section)}
        </Block>,
      ),
    );
    return out;
  }

  section.entries.forEach((e, i) => {
    const head = e.bullets.slice(0, BULLETS_IN_HEAD);
    const rest = e.bullets.slice(BULLETS_IN_HEAD);
    // Sequence: [head, …rest]. Keep the last two together so a single bullet is never stranded.
    const seq: { keep: Keep; node: ReactNode; cls: string; key: string }[] = [
      {
        key: `${e.ref}-head`,
        cls: classes('b-entry', i === 0 && 'b-first'),
        keep: 'together',
        node: (
          <>
            {hooks.entryHead(e, section)}
            {head.length > 0 && <Bullets items={head} />}
          </>
        ),
      },
      ...rest.map((b, k) => ({
        key: `${e.ref}-b${k}`,
        cls: 'b-bullet',
        keep: 'none' as Keep,
        node: <Bullets items={[b]} />,
      })),
    ];
    const chars = e.bullets.reduce((n, b) => n + b.length, 0);
    if (e.bullets.length <= KEEP_WHOLE_ENTRY_MAX_BULLETS && chars <= KEEP_WHOLE_ENTRY_MAX_CHARS) {
      // Ordinary-sized entries stay whole, so a page never starts with stray bullets from a job
      // whose title is on the previous page. Long entries may still split (between bullets).
      for (let k = 0; k < seq.length - 1; k++) seq[k]!.keep = 'with-next';
    } else if (seq.length >= 2) seq[seq.length - 2]!.keep = 'with-next';
    for (const s of seq)
      out.push(
        <Block kind={section.kind} key={s.key} keep={s.keep} className={s.cls} refId={e.ref}>
          {s.node}
        </Block>,
      );
  });
  return out;
}

const ICON_PATHS: Record<Contact['kind'], ReactNode> = {
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  email: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
};

export function ContactIcon({ kind }: { kind: Contact['kind'] }) {
  return (
    <svg
      className="cv-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[kind]}
    </svg>
  );
}

export function ContactList({
  contacts,
  separator,
  icons = false,
  stacked = false,
}: {
  contacts: Contact[];
  separator?: string;
  /** Show a small icon before each item. */
  icons?: boolean;
  /** One item per line (side columns). */
  stacked?: boolean;
}) {
  // Every item carries a leading separator; the first item on each line has it clipped away
  // (see .cv-contacts in base-css), so wrapped lines never start with a separator.
  return (
    <div
      className={classes(
        'cv-contacts-wrap',
        stacked && 'cv-contacts--stacked',
        icons && 'cv-contacts--icons',
      )}
    >
      <ul className="cv-contacts">
        {contacts.map((c, i) => (
          <li key={i} className={`cv-contact cv-contact--${c.kind}`}>
            {separator && !stacked && (
              <span className="cv-sep" aria-hidden="true">
                {separator}
              </span>
            )}
            {icons && <ContactIcon kind={c.kind} />}
            <span className="cv-contact-text">
              {c.label && c.kind === 'link' ? (
                <span className="cv-contact-label">{c.label}: </span>
              ) : null}
              {c.href ? <a href={c.href}>{breakable(c.text)}</a> : breakable(c.text)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Adds soft break opportunities after @ and / so addresses wrap at natural points, never mid-word or mid-domain. */
export function breakable(text: string): ReactNode {
  const parts = text.split(/(?<=[@/])/);
  if (parts.length < 2) return text;
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <wbr />}
    </span>
  ));
}

/** Profile photo, or initials when the design wants a mark but there is no photo. */
export function Portrait({
  model,
  className,
  fallback = 'initials',
}: {
  model: RenderModel;
  className: string;
  fallback?: 'initials' | 'none';
}) {
  if (model.photo)
    return (
      <div className={`cv-portrait ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static CV document, not app UI */}
        <img src={model.photo} alt={model.name ? `Photo of ${model.name}` : 'Profile photo'} />
      </div>
    );
  if (fallback === 'none' || !model.initials) return null;
  return (
    <div className={`cv-portrait cv-portrait--initials ${className}`} aria-hidden="true">
      <span>{model.initials}</span>
    </div>
  );
}

/** Entry meta text, as a link when it has one (e.g. project URLs). */
export function MetaText({ e }: { e: REntry }) {
  return e.metaHref ? <a href={e.metaHref}>{breakable(e.meta)}</a> : <>{e.meta}</>;
}

/** "Subtitle, meta" with the meta part linked when possible. */
export function SubMeta({ e, sep }: { e: REntry; sep: string }) {
  const sub = e.title ? e.subtitle : '';
  return (
    <>
      {sub}
      {sub && e.meta ? sep : ''}
      {e.meta && <MetaText e={e} />}
    </>
  );
}

/** Joins non-empty parts with a separator. */
export function joinParts(parts: string[], sep = ', '): string {
  return parts.filter(Boolean).join(sep);
}

export type TemplateComponentProps = { model: RenderModel; design: ResolvedDesign };
