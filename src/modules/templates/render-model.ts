import { formatPartialDate, formatRange } from '@/modules/resume/dates';
import type { ResumeDocument, Section, SectionKind } from '@/modules/resume/schema';

/**
 * Normalized, template-agnostic view of a document: hidden and empty content removed,
 * dates formatted, contacts listed. Templates render only this.
 */

export type Contact = {
  kind: 'phone' | 'email' | 'location' | 'link';
  text: string;
  label?: string;
};

export type REntry = {
  /** Reference back to the source for click-to-edit: `${sectionId}/${itemId}`. */
  ref: string;
  title: string;
  subtitle: string;
  meta: string;
  dates: string;
  bullets: string[];
  /** Skills keywords. */
  tags: string[];
  /** Skill-group label or language fluency. */
  label: string;
};

export type RSection = {
  id: string;
  kind: SectionKind | 'summary' | 'contact';
  title: string;
  entries: REntry[];
  text?: string;
};

export type RenderModel = {
  name: string;
  /** Name split for designs that set first and last name differently. */
  firstName: string;
  lastName: string;
  initials: string;
  /** Photo data URL, or '' when there is none or the design/user hides it. */
  photo: string;
  headline: string;
  contacts: Contact[];
  sections: RSection[];
  locale: string;
};

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const nonEmpty = (xs: string[]) => xs.map(clean).filter(Boolean);
const displayUrl = (u: string) =>
  clean(u)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');

function entriesOf(section: Section, locale: string): REntry[] {
  const ref = (itemId: string) => `${section.id}/${itemId}`;
  const blank = { title: '', subtitle: '', meta: '', dates: '', bullets: [], tags: [], label: '' };
  switch (section.kind) {
    case 'experience':
    case 'volunteering':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.role),
        subtitle: clean(i.organization),
        meta: clean(i.location),
        dates: formatRange(i.start, i.end, i.current, locale),
        bullets: nonEmpty(i.bullets),
      }));
    case 'education':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.qualification),
        subtitle: clean(i.institution),
        meta: clean(i.location),
        dates: formatRange(i.start, i.end, false, locale),
        bullets: nonEmpty(i.details),
      }));
    case 'projects':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.name),
        subtitle: clean(i.role),
        meta: displayUrl(i.link),
        dates: formatRange(i.start, i.end, false, locale),
        bullets: nonEmpty(i.bullets),
      }));
    case 'certifications':
    case 'licences':
    case 'awards':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.name),
        subtitle: clean(i.issuer),
        meta: clean(i.detail),
        dates: formatPartialDate(i.date, locale),
      }));
    case 'skills':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        label: clean(i.label),
        tags: nonEmpty(i.keywords),
      }));
    case 'languages':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.language),
        label: clean(i.fluency),
      }));
    case 'custom':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.title),
        subtitle: clean(i.subtitle),
        dates: clean(i.date),
        bullets: nonEmpty(i.bullets),
      }));
  }
}

const hasContent = (e: REntry) =>
  Boolean(e.title || e.subtitle || e.bullets.length || e.tags.length || e.label);

export function toRenderModel(doc: ResumeDocument): RenderModel {
  const b = doc.basics;
  const contacts: Contact[] = [];
  if (clean(b.phone)) contacts.push({ kind: 'phone', text: clean(b.phone) });
  if (clean(b.email)) contacts.push({ kind: 'email', text: clean(b.email) });
  if (clean(b.location)) contacts.push({ kind: 'location', text: clean(b.location) });
  for (const l of b.links)
    if (clean(l.url))
      contacts.push({ kind: 'link', text: displayUrl(l.url), label: clean(l.label) });

  const sections: RSection[] = [];
  if (clean(b.summary))
    sections.push({
      id: 'summary',
      kind: 'summary',
      title: 'Profile',
      entries: [],
      text: clean(b.summary),
    });
  for (const s of doc.sections) {
    if (s.hidden) continue;
    const entries = entriesOf(s, doc.locale).filter(hasContent);
    if (entries.length)
      sections.push({ id: s.id, kind: s.kind, title: clean(s.title) || s.kind, entries });
  }
  const name = clean(b.name);
  const words = name.split(' ').filter(Boolean);
  const firstName = words.length > 1 ? words.slice(0, -1).join(' ') : name;
  const lastName = words.length > 1 ? words[words.length - 1]! : '';
  const initials = (
    words.length > 1
      ? (words[0]![0] ?? '') + (words[words.length - 1]![0] ?? '')
      : (words[0] ?? '').slice(0, 2)
  ).toUpperCase();
  return {
    name,
    firstName,
    lastName,
    initials,
    photo: doc.design.options.showPhoto === false ? '' : b.photo,
    headline: clean(b.headline),
    contacts,
    sections,
    locale: doc.locale,
  };
}
