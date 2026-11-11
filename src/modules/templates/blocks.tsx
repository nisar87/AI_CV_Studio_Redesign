import type { ReactNode } from 'react';
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
  children,
}: {
  keep: Keep;
  className: string;
  refId?: string;
  children: ReactNode;
}) {
  return (
    <div data-block="" data-keep={keep} className={className} data-ref={refId}>
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
  summary: (text: string) => ReactNode;
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
  const out: ReactNode[] = [];
  out.push(
    <Block key={`${section.id}-h`} keep="with-next" className="b-heading">
      {hooks.heading(section)}
    </Block>,
  );

  if (section.kind === 'summary') {
    out.push(
      <Block
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
    const n = section.entries.length;
    section.entries.forEach((e, i) =>
      out.push(
        <Block
          key={e.ref}
          keep={listKeep(i, n)}
          className={`${isSkills ? 'b-skills' : 'b-compact'}${i === 0 ? 'b-first' : ''}`}
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
        cls: `b-entry${i === 0 ? ' b-first' : ''}`,
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
    if (seq.length >= 2) seq[seq.length - 2]!.keep = 'with-next';
    for (const s of seq)
      out.push(
        <Block key={s.key} keep={s.keep} className={s.cls} refId={e.ref}>
          {s.node}
        </Block>,
      );
  });
  return out;
}

export function ContactList({ contacts, separator }: { contacts: Contact[]; separator?: string }) {
  // Every item carries a leading separator; the first item on each line has it clipped away
  // (see .cv-contacts in base-css), so wrapped lines never start with a separator.
  return (
    <div className="cv-contacts-wrap">
      <ul className="cv-contacts">
        {contacts.map((c, i) => (
          <li key={i} className={`cv-contact cv-contact--${c.kind}`}>
            {separator && (
              <span className="cv-sep" aria-hidden="true">
                {separator}
              </span>
            )}
            {c.label && c.kind === 'link' ? (
              <span className="cv-contact-label">{c.label}: </span>
            ) : null}
            {c.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Joins non-empty parts with a separator. */
export function joinParts(parts: string[], sep = ', '): string {
  return parts.filter(Boolean).join(sep);
}

export type TemplateComponentProps = { model: RenderModel; design: ResolvedDesign };
