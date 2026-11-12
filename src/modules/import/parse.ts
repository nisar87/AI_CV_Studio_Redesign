import { newId } from '@/modules/resume/create';
import {
  designSpec,
  type CredentialItem,
  type EducationItem,
  type ExperienceItem,
  type LanguageItem,
  type ProjectItem,
  type ResumeDocument,
  type Section,
  type SectionKind,
  type SkillGroupItem,
} from '@/modules/resume/schema';

/**
 * Turns the plain lines of an existing CV into a structured CV (R1.5). Deterministic and
 * conservative: it only moves the person's own words into fields, and any line it cannot place
 * goes to an "Other" section, so nothing is ever dropped. The person reviews the result.
 */

type Kind = SectionKind | 'summary' | 'contact';
/** Lower-case letters only; "&" and "and" are the same. */
const headingKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\band\b/g, '')
    .replace(/[^a-z]/g, '');

/** Heading words → section kind. Keys are lower-case letters only (handles "W O R K  H I S T O R Y"). */
const HEADINGS: Record<string, { kind: Kind; title: string }> = {};
const add = (kind: Kind, title: string, ...keys: string[]) =>
  keys.forEach((k) => (HEADINGS[headingKey(k)] = { kind, title }));
add(
  'summary',
  'Profile',
  'profile',
  'summary',
  'professional summary',
  'personal profile',
  'about me',
  'about',
  'objective',
  'career objective',
  'personal statement',
  'career summary',
  'professional profile',
  'overview',
);
add(
  'contact',
  'Contact',
  'contact',
  'contact details',
  'contact information',
  'contact info',
  'personal details',
  'personal information',
  'get in touch',
);
add(
  'experience',
  'Work experience',
  'experience',
  'work experience',
  'professional experience',
  'employment',
  'employment history',
  'work history',
  'career history',
  'relevant experience',
  'experience and employment',
  'professional background',
  'career',
  'job history',
  'positions held',
);
add(
  'education',
  'Education',
  'education',
  'education and training',
  'academic background',
  'qualifications',
  'academic qualifications',
  'education and qualifications',
  'academic history',
  'educational background',
);
add(
  'skills',
  'Skills',
  'skills',
  'key skills',
  'technical skills',
  'core skills',
  'core competencies',
  'competencies',
  'expertise',
  'areas of expertise',
  'skills and abilities',
  'professional skills',
  'skills summary',
  'tools',
  'technologies',
  'it skills',
  'computer skills',
  'strengths',
);
add('languages', 'Languages', 'languages', 'language skills', 'language');
add(
  'certifications',
  'Certifications',
  'certifications',
  'certificates',
  'certification',
  'courses',
  'training',
  'professional development',
  'licenses and certifications',
  'licences and certifications',
  'courses and certifications',
  'training and certifications',
);
add(
  'licences',
  'Licences',
  'licences',
  'licenses',
  'driving licence',
  'driving license',
  'driving licences',
);
add(
  'projects',
  'Projects',
  'projects',
  'key projects',
  'selected projects',
  'personal projects',
  'academic projects',
);
add(
  'volunteering',
  'Volunteering',
  'volunteering',
  'volunteer experience',
  'volunteer work',
  'voluntary work',
  'community involvement',
);
add(
  'awards',
  'Awards',
  'awards',
  'achievements',
  'honours',
  'honors',
  'awards and achievements',
  'key achievements',
  'accomplishments',
);
add(
  'custom',
  'Interests',
  'interests',
  'hobbies',
  'hobbies and interests',
  'interests and hobbies',
);
add('custom', 'References', 'references', 'referees');
add('custom', 'Publications', 'publications');
add(
  'custom',
  'Board & advisory roles',
  'board and advisory roles',
  'board roles',
  'advisory roles',
  'board advisory roles',
  'non executive roles',
  'directorships',
  'appointments',
);
add(
  'custom',
  'Additional information',
  'additional information',
  'other information',
  'personal information and interests',
);
add('custom', 'Memberships', 'memberships', 'professional memberships', 'affiliations');

export function headingOf(line: string): { kind: Kind; title: string } | null {
  if (line.startsWith(SPACED_MARK)) {
    const words = line.slice(1);
    const known = headingOf(words);
    if (known) return known;
    const t = words.toLowerCase();
    return { kind: 'custom', title: (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 80) };
  }
  if (line.length > 48 || /[!?]$/.test(line) || /\d{3}/.test(line)) return null;
  if (/\.$/.test(line) && line.split(' ').length > 4) return null;
  return HEADINGS[headingKey(line.replace(/[.:\-–—|]+$/, ''))] ?? null;
}

// ---------- dates ----------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const POINT = `(?:${MONTH}\\s*,?\\s*\\d{4}|\\d{1,2}\\s*[/.]\\s*\\d{4}|\\d{4}\\s*-\\s*(?:0[1-9]|1[0-2])(?!\\d)|(?:19|20)\\d{2})`;
const NOW = '(?:present|current|now|today|to date|ongoing|date)';
const RANGE = new RegExp(`(${POINT})\\s*(?:–|—|-|to|until|till)\\s*(${POINT}|${NOW})`, 'i');
const SINGLE = new RegExp(`(?:^|[\\s(·|,])(${POINT})(?=$|[\\s)·|,])`, 'i');

/** "Sep 2020" → "2020-09"; "2019" → "2019"; "03/2021" → "2021-03". */
export function toPartial(raw: string): string {
  const s = raw.trim().toLowerCase();
  let m = s.match(/^([a-z]+)\.?\s*,?\s*(\d{4})$/);
  if (m) {
    const i = MONTHS.indexOf(m[1]!.slice(0, 3));
    return i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, '0')}` : (m[2] ?? '');
  }
  m = s.match(/^(\d{1,2})\s*[/.]\s*(\d{4})$/);
  if (m) {
    const mo = Number(m[1]);
    return mo >= 1 && mo <= 12 ? `${m[2]}-${String(mo).padStart(2, '0')}` : (m[2] ?? '');
  }
  m = s.match(/^(\d{4})\s*-\s*(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/(\d{4})/);
  return m ? m[1]! : '';
}

export type FoundDates = { start: string; end: string; current: boolean; rest: string } | null;

/** Finds a date range (or a single date) in a line and returns the line without it. */
export function findDates(line: string): FoundDates {
  const tidy = (s: string) =>
    s
      .replace(/\(\s*\)/g, '')
      .replace(/\s*[|·•,–—-]\s*$/, '')
      .replace(/^\s*[|·•,–—-]\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  const r = line.match(RANGE);
  if (r) {
    const current = new RegExp(`^${NOW}$`, 'i').test(r[2]!.trim());
    return {
      start: toPartial(r[1]!),
      end: current ? '' : toPartial(r[2]!),
      current,
      rest: tidy(line.replace(r[0], ' ')),
    };
  }
  const one = line.match(SINGLE);
  if (one) {
    // A lone 4-digit number inside a sentence is more likely content than a date.
    if (line.length > 70) return null;
    return {
      start: '',
      end: toPartial(one[1]!),
      current: false,
      rest: tidy(line.replace(one[1]!, ' ')),
    };
  }
  return null;
}

// ---------- contacts ----------

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(?:\+|00)?\d[\d\s().-]{7,}\d/;
const URL =
  /(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|me|co|uk|pk|ai|app|info|site|online|tech|in)(?:\.[a-z]{2})?(?:\/[^\s,·|]*)?/i;

type Contacts = {
  email: string;
  phone: string;
  links: { label: string; url: string }[];
  location: string;
};

/** Pulls email, phone and links out of a line; returns what's left. */
function takeContacts(line: string, c: Contacts): string {
  let rest = line;
  const e = rest.match(EMAIL);
  if (e) {
    if (!c.email) c.email = e[0];
    rest = rest.replace(e[0], ' ');
  }
  for (;;) {
    const u = rest.match(URL);
    if (!u || u[0].length < 6) break;
    const labelled = rest.match(new RegExp(`([A-Za-z][A-Za-z ]{1,20}):\\s*${escape(u[0])}`));
    const label = labelled?.[1]?.trim() ?? linkLabel(u[0]);
    if (c.links.length < 10) c.links.push({ label, url: u[0] });
    rest = rest.replace(labelled?.[0] ?? u[0], ' ');
  }
  const p = rest.match(PHONE);
  if (p && p[0].replace(/\D/g, '').length >= 9 && p[0].replace(/\D/g, '').length <= 15) {
    if (!c.phone) c.phone = p[0].trim();
    rest = rest.replace(p[0], ' ');
  }
  rest = rest.replace(/\b(?:email|e-mail|phone|tel|mobile|cell|address|web|website)\s*:/gi, ' ');
  return rest
    .split(/\s*[|·•]\s*|\s{2,}/)
    .map((s) =>
      s
        .trim()
        .replace(/^[,;:]+|[,;:]+$/g, '')
        .trim(),
    )
    .filter(Boolean)
    .join(' · ');
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
function linkLabel(url: string) {
  if (/linkedin/i.test(url)) return 'LinkedIn';
  if (/github/i.test(url)) return 'GitHub';
  if (/behance/i.test(url)) return 'Behance';
  if (/dribbble/i.test(url)) return 'Dribbble';
  return 'Website';
}

// ---------- line clean-up ----------

const BULLET = /^\s*(?:[•●▪■◦○∙‣⁃*·➢➤►▸✓✔-]|–|—|\d{1,2}[.)])\s+/;

/** Joins lines that a PDF wrapped mid-sentence; strips bullet symbols. */
export function mergeWrapped(lines: string[]): { text: string; bullet: boolean }[] {
  const out: { text: string; bullet: boolean }[] = [];
  for (const raw of lines) {
    const bullet = BULLET.test(raw);
    const text = raw.replace(BULLET, '').trim();
    if (!text) continue;
    const prev = out[out.length - 1];
    const continues =
      prev &&
      !bullet &&
      !headingOf(text) &&
      !/[.!?:]$/.test(prev.text) &&
      (/^[a-z(&]/.test(text) ||
        /[-,&/]$/.test(prev.text) ||
        /\b(?:and|or|of|the|to|with|for|in|a|an)$/i.test(prev.text)) &&
      !findDates(text);
    if (continues) prev.text = prev.text.endsWith('-') ? prev.text + text : `${prev.text} ${text}`;
    else out.push({ text, bullet });
  }
  return out;
}

const looksSentence = (s: string) => s.length > 70 || (/[.!?]$/.test(s) && s.split(' ').length > 6);

// ---------- entries ----------

type Entry = { head: string[]; body: string[]; dates: FoundDates };

/**
 * Splits a section into entries: a short header (with dates) followed by detail lines.
 * When the section has dates, entries start only at dated lines. A date printed on its own line
 * takes the header lines just above it — as many as the previous entry had before its date
 * (e.g. "Role / Company / date" → 2, "Title / date / School" → 1).
 */
function entries(lines: { text: string; bullet: boolean }[]): Entry[] {
  const found = lines.map((l) => (l.bullet ? null : findDates(l.text)));
  // If the section uses date ranges, a lone year (e.g. "…by 18% in 2023") is content, not a date.
  const ranges = found.some((d) => d && d.start);
  const dated = found.map((d) => (d && ranges && !d.start ? null : d));
  const hasDates = dated.some(Boolean);
  type E = Entry & { all: { text: string; bullet: boolean }[]; before: number };
  const out: E[] = [];
  let cur: E | null = null;
  lines.forEach((line, i) => {
    const d = dated[i] ?? null;
    let startsNew = !cur;
    if (cur && hasDates && d)
      startsNew = !!(cur.dates || cur.body.length > 0 || (d.rest && cur.head.length >= 2));
    if (cur && !hasDates)
      startsNew =
        !line.bullet &&
        cur.body.length > 0 &&
        !looksSentence(line.text) &&
        line.text.length < 60 &&
        headerish(line.text);
    if (startsNew) {
      const next: E = { head: [], body: [], dates: null, all: [], before: 0 };
      if (cur && d && !d.rest) {
        const want = Math.max(1, Math.min(2, out[0]?.before ?? 1));
        const moved: string[] = [];
        while (moved.length < want && cur.all.length > 1) {
          const last = cur.all[cur.all.length - 1]!;
          if (last.bullet || looksSentence(last.text) || last.text.length > 90) break;
          cur.all.pop();
          const inBody = cur.body[cur.body.length - 1] === last.text;
          if (inBody) cur.body.pop();
          else if (cur.head[cur.head.length - 1] === last.text) cur.head.pop();
          moved.unshift(last.text);
        }
        next.head.push(...moved);
        next.all.push(...moved.map((text) => ({ text, bullet: false })));
      }
      cur = next;
      out.push(cur);
    }
    const e = cur!;
    e.all.push(line);
    if (d && !e.dates) {
      e.dates = d;
      e.before = e.head.length;
      if (d.rest) e.head.push(d.rest);
    } else if (
      !line.bullet &&
      e.body.length === 0 &&
      e.head.length < 3 &&
      !looksSentence(line.text)
    )
      e.head.push(line.text);
    else e.body.push(line.text);
  });
  return out.filter((e) => e.head.length || e.body.length);
}
const headerish = (s: string) => /^[A-Z]/.test(s) && s.split(' ').length <= 8;

/** "Role at Company", "Role — Company", "Role | Company" → [role, org]. */
function splitRoleOrg(s: string): [string, string] {
  const at = s.match(/^(.+?)\s+at\s+(.+)$/i);
  if (at) return [at[1]!.trim(), at[2]!.trim()];
  const sep = s.split(/\s+[—–|]\s+|\s+-\s+/);
  if (sep.length >= 2) return [sep[0]!.trim(), sep.slice(1).join(' – ').trim()];
  return [s, ''];
}

/** "Company · City" or "Company, City" → [org, location]. */
function splitOrgPlace(s: string): [string, string] {
  const dot = s.split(/\s*[·|•]\s*/);
  if (dot.length >= 2) return [dot.slice(0, -1).join(' · '), dot[dot.length - 1]!];
  const comma = s.match(/^(.+),\s*([A-Z][A-Za-z .'-]{1,40})$/);
  if (comma && comma[2]!.split(' ').length <= 3) return [comma[1]!, comma[2]!];
  return [s, ''];
}

function experienceItems(lines: { text: string; bullet: boolean }[]): ExperienceItem[] {
  return entries(lines).map((e) => {
    let [role, org] = splitRoleOrg(e.head[0] ?? '');
    let location = '';
    if (e.head[1]) {
      const [o, l] = splitOrgPlace(e.head[1]);
      if (org) location = e.head[1];
      else [org, location] = [o, l];
    } else if (org) [org, location] = splitOrgPlace(org);
    const extra = e.head.slice(2);
    if (!role && org) [role, org] = [org, ''];
    return {
      id: newId(),
      role: role.slice(0, 160),
      organization: org.slice(0, 160),
      location: location.slice(0, 120),
      start: e.dates?.start ?? '',
      end: e.dates?.end ?? '',
      current: e.dates?.current ?? false,
      bullets: [...extra, ...e.body].slice(0, 40).map((b) => b.slice(0, 600)),
    };
  });
}

function educationItems(lines: { text: string; bullet: boolean }[]): EducationItem[] {
  return entries(lines).map((e) => {
    const [qualification, inst] = splitRoleOrg(e.head[0] ?? '');
    let institution = inst;
    let location = '';
    if (e.head[1]) {
      if (institution) location = e.head[1];
      else [institution, location] = splitOrgPlace(e.head[1]);
    }
    return {
      id: newId(),
      qualification: qualification.slice(0, 200),
      institution: institution.slice(0, 200),
      location: location.slice(0, 120),
      start: e.dates?.start ?? '',
      end: e.dates?.end ?? '',
      details: [...e.head.slice(2), ...e.body].slice(0, 40).map((b) => b.slice(0, 600)),
    };
  });
}

function projectItems(lines: { text: string; bullet: boolean }[]): ProjectItem[] {
  return entries(lines).map((e) => {
    const c: Contacts = { email: '', phone: '', links: [], location: '' };
    const head = e.head.map((h) => takeContacts(h, c)).filter(Boolean);
    return {
      id: newId(),
      name: (head[0] ?? '').slice(0, 160),
      role: (head[1] ?? '').slice(0, 120),
      link: (c.links[0]?.url ?? '').slice(0, 300),
      start: e.dates?.start ?? '',
      end: e.dates?.end ?? '',
      bullets: [...head.slice(2), ...e.body].slice(0, 40).map((b) => b.slice(0, 600)),
    };
  });
}

function skillItems(lines: { text: string; bullet: boolean }[]): SkillGroupItem[] {
  const groups: SkillGroupItem[] = [];
  const loose: string[] = [];
  const split = (s: string) =>
    s
      .split(/\s*[,;·•|]\s*|\s+\/\s+|\s{2,}/)
      .map((x) => x.trim().replace(/\.$/, ''))
      .filter((x) => x && x.length <= 160);
  let label: string | null = null;
  // Labels ("Platforms") appear first or right after another labelled group, never mid-list.
  let labelled_mode = false;
  lines.forEach(({ text }, i) => {
    const labelled = text.match(/^([A-Za-z][\w &/+-]{1,40}):\s*(.+)$/);
    const next = lines[i + 1]?.text ?? '';
    if (labelled) {
      groups.push({
        id: newId(),
        label: labelled[1]!.trim(),
        keywords: split(labelled[2]!).slice(0, 60),
      });
      label = null;
    } else if (
      !/[,;·•|]/.test(text) &&
      text.split(' ').length <= 2 &&
      /[,;·•|]|\s\/\s/.test(next) &&
      (i === 0 || labelled_mode)
    ) {
      // A short label line followed by a list ("Platforms" / "AWS · Kafka · Redis").
      label = text.replace(/:$/, '');
      labelled_mode = true;
    } else if (label) {
      groups.push({ id: newId(), label, keywords: split(text).slice(0, 60) });
      label = null;
      labelled_mode = true;
    } else {
      // A continuation of the last labelled group's list, or loose skills.
      const g = labelled_mode ? groups[groups.length - 1] : undefined;
      if (g) g.keywords.push(...split(text));
      else loose.push(...split(text));
    }
  });
  if (loose.length)
    groups.unshift({
      id: newId(),
      label: groups.length ? 'Other' : '',
      keywords: loose.slice(0, 60),
    });
  return groups;
}

const FLUENCY =
  /\b(native|mother tongue|bilingual|fluent|proficient|advanced|upper[- ]intermediate|intermediate|conversational|basic|beginner|elementary|working knowledge|professional working|limited working|full professional|[ABC][12])\b.*$/i;

function languageItems(lines: { text: string; bullet: boolean }[]): LanguageItem[] {
  const out: LanguageItem[] = [];
  for (const { text } of lines)
    for (const part of text.split(/\s*[,;·•|]\s*/)) {
      if (!part) continue;
      const paren = part.match(/^(.+?)\s*\((.+)\)$/);
      const dash = part.match(/^(.+?)\s*[:–—-]\s*(.+)$/);
      const flu = part.match(FLUENCY);
      const [language, fluency] = paren
        ? [paren[1]!, paren[2]!]
        : dash
          ? [dash[1]!, dash[2]!]
          : flu
            ? [part.slice(0, flu.index).trim(), flu[0]]
            : [part, ''];
      out.push({
        id: newId(),
        language: language.trim().slice(0, 80),
        fluency: fluency.trim().slice(0, 240),
      });
    }
  return out;
}

function credentialItems(lines: { text: string; bullet: boolean }[]): CredentialItem[] {
  const out: CredentialItem[] = [];
  for (const { text } of lines) {
    const d = findDates(text);
    const rest = d ? d.rest : text;
    const parts = rest.split(/\s*[·|•]\s*|\s+[—–]\s+|\s+-\s+/).filter(Boolean);
    const prev = out[out.length - 1];
    // A date or issuer on its own line belongs to the item above.
    if (
      prev &&
      (!rest || (parts.length === 1 && d && !prev.date && rest.length < 40 && !prev.issuer))
    ) {
      if (rest && !prev.issuer) prev.issuer = rest.slice(0, 160);
      if (d && !prev.date) prev.date = d.end || d.start;
      continue;
    }
    out.push({
      id: newId(),
      name: (parts[0] ?? rest).slice(0, 200),
      issuer: parts.slice(1).join(' · ').slice(0, 160),
      date: d ? d.end || d.start : '',
      detail: '',
    });
  }
  return out;
}

function customSection(title: string, lines: { text: string; bullet: boolean }[]): Section {
  return {
    id: newId(),
    kind: 'custom',
    title: title.slice(0, 80),
    hidden: false,
    items: [
      {
        id: newId(),
        title: '',
        subtitle: '',
        date: '',
        bullets: lines.map((l) => l.text.slice(0, 600)).slice(0, 40),
      },
    ],
  };
}

const niceTitle = (raw: string, fallback: string) => {
  const t = raw.replace(/[:\-–—|]+$/, '').trim();
  // Letter-spaced ("P R O F I L E") or all caps → use the standard title.
  if (/^(?:\S\s){2,}\S/.test(t) || t === t.toUpperCase()) return fallback;
  return t;
};

// ---------- main ----------

export type ImportReport = {
  name: boolean;
  email: boolean;
  phone: boolean;
  summary: boolean;
  sections: { kind: SectionKind; title: string; items: number }[];
  /** Lines we could not place and kept in an "Other" section for the person to sort. */
  unplaced: number;
};

export function parseCv(
  input: string[],
  opts: { now?: Date; locale?: string; title?: string } = {},
): { doc: ResumeDocument; report: ImportReport } {
  const now = (opts.now ?? new Date()).toISOString();
  const c: Contacts = { email: '', phone: '', links: [], location: '' };

  // 1. Split into the header block and headed sections.
  const blocks: { heading: { kind: Kind; title: string; raw: string } | null; lines: string[] }[] =
    [{ heading: null, lines: [] }];
  let prevLine = '';
  for (const line of joinSpacedHeadings(input)) {
    const last = blocks[blocks.length - 1]!;
    // "…Department for" / "Education": a heading word that finishes the line above is not a heading.
    const dangling = /(?:\b(?:for|of|and|in|the|to|with|at)|[,&/(-])$/i.test(prevLine);
    prevLine = line;
    let h = dangling ? null : headingOf(line);
    if (h?.kind === 'custom' && line.startsWith(SPACED_MARK) && blocks.length === 1) h = null;
    // "Skills" immediately followed by "Languages" (a skill group label, e.g. programming).
    if (h && h.kind === 'languages' && last.heading?.kind === 'skills' && !last.lines.length)
      last.lines.push(line);
    else if (h) blocks.push({ heading: { ...h, raw: line.replace(SPACED_MARK, '') }, lines: [] });
    else last.lines.push(line.replace(SPACED_MARK, ''));
  }

  // 2. Header: name, headline, contacts; anything long is the summary.
  const head: { text: string; contact: boolean }[] = [];
  for (const raw of blocks[0]!.lines) {
    const contact = EMAIL.test(raw) || PHONE.test(raw) || URL.test(raw);
    let rest = takeContacts(raw, c);
    // Monogram printed in front of the name ("AR Ali Raza").
    const m = rest.match(/^([A-Z]{2,3})(?:\s*·\s*|\s+)(.+)$/);
    if (m && initials(m[2]!).startsWith(m[1]!)) rest = m[2]!;
    if (rest) head.push({ text: rest, contact });
  }
  // A name split over two lines ("Imran" / "Qureshi").
  if (
    head.length > 1 &&
    /^\p{Lu}[\p{L}'-]+$/u.test(head[0]!.text) &&
    /^\p{Lu}[\p{L}'-]+$/u.test(head[1]!.text)
  ) {
    head[0]!.text = `${head[0]!.text} ${head[1]!.text}`;
    head.splice(1, 1);
  }
  const nameIdx = pickName(head.slice(0, 6));
  const name = nameIdx >= 0 ? head[nameIdx]!.text : '';
  let headline = '';
  const summary: string[] = [];
  const other: string[] = [];
  const mono = initials(name);
  head.forEach(({ text, contact }, i) => {
    if (i === nameIdx) return;
    // Monogram letters printed as a design element ("GM", or "IQ Multi-drop driver").
    let t = text;
    if (mono.length >= 2 && (t === mono || t.startsWith(`${mono} `)))
      t = t.slice(mono.length).trim();
    if (!t || t.toUpperCase() === name.toUpperCase()) return;
    if (contact && t.length <= 60) {
      if (!c.location) c.location = t.replace(/\s·\s/g, ', ');
      return;
    }
    if (!headline && !looksSentence(t) && t.length <= 90) {
      headline = /^(?:\S\s){3,}/.test(t) ? t.replace(/(\S)\s(?=\S(\s|$))/g, '$1') : t;
      return;
    }
    if (looksSentence(t) || summary.length) summary.push(t);
    else other.push(t);
  });

  // 3. Sections.
  const sections: Section[] = [];
  const merged = new Map<SectionKind, Section>();
  const running = (l: string) =>
    !!name && (l === name || l.startsWith(`${name} `)) && l.length < name.length + 100;
  // Two-column designs print the side column before page 2 of the main column. A running header
  // marks the page break; dated entries right after it continue the last timeline section.
  const LISTS: Kind[] = ['experience', 'volunteering', 'education', 'projects'];
  for (let bi = 1; bi < blocks.length; bi++) {
    const b = blocks[bi]!;
    const at = b.lines.findIndex(running);
    if (at < 0 || LISTS.includes(b.heading!.kind)) continue;
    const tail = b.lines.slice(at + 1);
    if (!tail.slice(0, 3).some((l) => findDates(l)?.start)) continue;
    const target = blocks
      .slice(1, bi)
      .reverse()
      .find((x) => LISTS.includes(x.heading!.kind));
    if (!target) continue;
    b.lines = b.lines.slice(0, at);
    target.lines.push(...tail);
  }
  for (const b of blocks.slice(1)) {
    const h = b.heading!;
    const lines = mergeWrapped(b.lines.filter((l) => !running(l)));
    if (h.kind === 'summary') {
      summary.push(...lines.map((l) => l.text));
      continue;
    }
    if (h.kind === 'contact') {
      const left = lines.map((l) => takeContacts(l.text, c)).filter(Boolean);
      if (!c.location && left[0] && left[0].length <= 60) c.location = left.shift()!;
      other.push(...left);
      continue;
    }
    const title = niceTitle(h.raw, h.title);
    let section: Section;
    switch (h.kind) {
      case 'experience':
      case 'volunteering':
        section = {
          id: newId(),
          kind: h.kind,
          title,
          hidden: false,
          items: experienceItems(lines),
        };
        break;
      case 'education':
        section = {
          id: newId(),
          kind: 'education',
          title,
          hidden: false,
          items: educationItems(lines),
        };
        break;
      case 'projects':
        section = {
          id: newId(),
          kind: 'projects',
          title,
          hidden: false,
          items: projectItems(lines),
        };
        break;
      case 'skills':
        section = { id: newId(), kind: 'skills', title, hidden: false, items: skillItems(lines) };
        break;
      case 'languages':
        section = {
          id: newId(),
          kind: 'languages',
          title,
          hidden: false,
          items: languageItems(lines),
        };
        break;
      case 'certifications':
      case 'licences':
      case 'awards':
        section = {
          id: newId(),
          kind: h.kind,
          title,
          hidden: false,
          items: credentialItems(lines),
        };
        break;
      default:
        section = customSection(title, lines);
    }
    if (!section.items.length) continue;
    // Two headings of the same kind (e.g. "Skills" and "Technical skills") → one section.
    const prev = h.kind !== 'custom' ? merged.get(section.kind) : undefined;
    if (prev) (prev.items as unknown[]).push(...section.items);
    else {
      sections.push(section);
      if (section.kind !== 'custom') merged.set(section.kind, section);
    }
  }
  if (other.length)
    sections.push(
      customSection(
        'Other',
        other.map((text) => ({ text, bullet: false })),
      ),
    );

  const doc: ResumeDocument = {
    schemaVersion: 1,
    id: newId(),
    title: (opts.title || (name ? `${name} — imported` : 'Imported CV')).slice(0, 120),
    presetId: 'general',
    locale: opts.locale ?? 'en-GB',
    createdAt: now,
    updatedAt: now,
    basics: {
      name: name.slice(0, 120),
      headline: headline.slice(0, 160),
      email: c.email.slice(0, 160),
      phone: c.phone.slice(0, 60),
      location: c.location.slice(0, 160),
      links: c.links
        .slice(0, 10)
        .map((l) => ({ id: newId(), label: l.label.slice(0, 60), url: l.url.slice(0, 300) })),
      summary: summary.join('\n\n').slice(0, 1500),
      photo: '',
    },
    sections: sections.slice(0, 30),
    design: designSpec.parse({}),
  };
  return {
    doc,
    report: {
      name: !!doc.basics.name,
      email: !!doc.basics.email,
      phone: !!doc.basics.phone,
      summary: !!doc.basics.summary,
      sections: doc.sections.map((s) => ({ kind: s.kind, title: s.title, items: s.items.length })),
      unplaced: other.length,
    },
  };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

const JOB_WORDS =
  /\b(?:driver|teacher|engineer|manager|nurse|officer|assistant|developer|designer|analyst|consultant|director|graduate|student|accountant|executive|specialist|operative|technician|lead|cv|resume|curriculum|vitae)\b/i;

/** Index of the line that looks most like a person's name (or -1). */
function pickName(lines: { text: string; contact: boolean }[]): number {
  let best = -1;
  let bestScore = 0;
  lines.forEach(({ text, contact }, i) => {
    if (contact) return;
    const words = text.split(/\s+/);
    let score = 0;
    if (words.length >= 2 && words.length <= 4) score += 3;
    else if (words.length === 1 || words.length <= 6) score += 1;
    if (words.every((w) => /^\p{Lu}[\p{L}'.-]*$/u.test(w))) score += 2;
    if (/\d|[,:;|@]/.test(text)) score -= 4;
    if (JOB_WORDS.test(text)) score -= 3;
    if (/^[A-Z]{1,3}$/.test(text)) score -= 5;
    score -= i * 0.5;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** "WO R K" + "H I S TO RY" (a letter-spaced heading wrapped over lines) → one line. */
const SPACED = /^(?:\S{1,2}\s)+\S{1,2}$/;
/** Marks a letter-spaced heading line; such lines are headings even when the words are new. */
export const SPACED_MARK = '\u0001';

function joinSpacedHeadings(lines: string[]): string[] {
  const spaced = (l: string) => {
    if (l === '&') return true;
    if (!SPACED.test(l) || /\p{Ll}/u.test(l)) return false;
    const t = l.split(' ');
    return t.length >= 3 && t.filter((x) => x.length === 1).length / t.length >= 0.6;
  };
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (!spaced(l) || l === '&' || l.replace(/\s/g, '').length < 3) {
      out.push(l);
      continue;
    }
    const parts = [l];
    while (i + 1 < lines.length && parts.length < 4 && spaced(lines[i + 1]!))
      parts.push(lines[++i]!);
    out.push(SPACED_MARK + parts.map((p) => p.replace(/\s/g, '')).join(' '));
  }
  return out;
}
