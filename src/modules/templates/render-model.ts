import { formatPartialDate, formatRange } from '@/modules/resume/dates';
import {
  LAYOUT_KIND,
  type LanguageLevel,
  type ResumeDocument,
  type Section,
  type SectionKind,
} from '@/modules/resume/schema';

/**
 * Normalized, template-agnostic view of a document: hidden and empty content removed,
 * dates formatted, contacts listed. Templates render only this.
 */

export type Contact = {
  kind: 'phone' | 'email' | 'location' | 'link';
  text: string;
  label?: string;
  /** Link target for PDFs (tel:, mailto:, https:). */
  href?: string;
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
  /** Link for `meta` (e.g. a project URL). */
  metaHref?: string;
  /** Skill levels 1–5 per tag (0 = not set); present only when the person set levels. */
  levels?: number[];
  /** Language level as 1–5 (0 = not set). */
  level?: number;
  /** Lines shown as plain text, not as bullet points (declaration, quote, strength). */
  plain?: boolean;
};

export type RSection = {
  id: string;
  /** Layout kind: new kinds borrow an existing kind's layout (LAYOUT_KIND). */
  kind: SectionKind | 'summary' | 'contact';
  /** The section's own kind, when it differs from `kind`. */
  sourceKind?: SectionKind;
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
    case 'military':
    case 'internships':
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
        metaHref: toHref(i.link),
        dates: formatRange(i.start, i.end, false, locale),
        bullets: nonEmpty(i.bullets),
      }));
    case 'certifications':
    case 'licences':
    case 'awards':
    case 'publications':
    case 'courses':
    case 'memberships':
    case 'conferences':
    case 'patents':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.name),
        subtitle: clean(i.issuer),
        meta: clean(i.detail) || (i.link ? displayUrl(i.link) : ''),
        metaHref: !clean(i.detail) && i.link ? toHref(i.link) : undefined,
        dates: formatPartialDate(i.date, locale),
      }));
    case 'skills':
    case 'interests':
      return section.items.map((i) => {
        // Levels stay paired with their keyword when empty keywords are dropped.
        const pairs = i.keywords
          .map((k, n) => ({ k: clean(k), l: i.levels?.[n] ?? 0 }))
          .filter((p) => p.k);
        return {
          ...blank,
          ref: ref(i.id),
          label: clean(i.label),
          tags: pairs.map((p) => p.k),
          levels: pairs.some((p) => p.l > 0) ? pairs.map((p) => p.l) : undefined,
        };
      });
    case 'languages':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.language),
        label: clean(i.fluency) || levelLabel(i.level),
        level: levelValue(i.level),
      }));
    case 'personalDetails':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.label),
        label: clean(i.value),
      }));
    case 'references':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.name),
        subtitle: [clean(i.role), clean(i.organization)].filter(Boolean).join(', '),
        bullets: nonEmpty([i.contact]),
        plain: true,
      }));
    case 'strengths':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.title),
        bullets: nonEmpty([i.text]),
        plain: true,
      }));
    case 'testimonials':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        title: clean(i.name),
        subtitle: clean(i.role),
        bullets: clean(i.quote) ? [`“${clean(i.quote).replace(/^[“"]|[”"]$/g, '')}”`] : [],
        plain: true,
      }));
    case 'declaration':
      return section.items.map((i) => ({
        ...blank,
        ref: ref(i.id),
        bullets: nonEmpty([i.text, [i.place, i.date].map(clean).filter(Boolean).join(', ')]),
        plain: true,
      }));
    case 'custom':
    case 'achievements':
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

const LEVEL_VALUE: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 3,
  C1: 4,
  C2: 5,
  basic: 1,
  conversational: 3,
  fluent: 4,
  native: 5,
};
const levelValue = (l?: LanguageLevel) => (l ? (LEVEL_VALUE[l] ?? 0) : 0);
const LEVEL_LABEL: Record<string, string> = {
  basic: 'Basic',
  conversational: 'Conversational',
  fluent: 'Fluent',
  native: 'Native',
};
const levelLabel = (l?: LanguageLevel) => (l ? (LEVEL_LABEL[l] ?? l) : '');

/** Only http(s) links are made clickable; anything else stays plain text. */
function toHref(url: string): string | undefined {
  const u = clean(url);
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(withScheme) ? withScheme : undefined;
}

const hasContent = (e: REntry) =>
  Boolean(e.title || e.subtitle || e.bullets.length || e.tags.length || e.label);

export function toRenderModel(doc: ResumeDocument): RenderModel {
  const b = doc.basics;
  const contacts: Contact[] = [];
  if (clean(b.phone))
    contacts.push({
      kind: 'phone',
      text: clean(b.phone),
      href: `tel:${clean(b.phone).replace(/[^\d+]/g, '')}`,
    });
  if (clean(b.email))
    contacts.push({ kind: 'email', text: clean(b.email), href: `mailto:${clean(b.email)}` });
  if (clean(b.location)) contacts.push({ kind: 'location', text: clean(b.location) });
  for (const l of b.links)
    if (clean(l.url))
      contacts.push({
        kind: 'link',
        text: displayUrl(l.url),
        label: clean(l.label),
        href: toHref(l.url),
      });

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
    const kind = LAYOUT_KIND[s.kind];
    if (entries.length)
      sections.push({
        id: s.id,
        kind,
        ...(kind !== s.kind ? { sourceKind: s.kind } : {}),
        title: clean(s.title) || s.kind,
        entries,
      });
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
