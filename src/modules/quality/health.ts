import type { ExperienceItem, ResumeDocument } from '@/modules/resume/schema';

/**
 * CV health check (Release 2). Deterministic, explainable findings — no invented score. Each
 * finding says what was found, why it matters, and points at the field to change (`ref` uses the
 * editor's "sectionId/itemId" format). Suggestions never ask for facts that aren't true.
 */
export type Severity = 'fix' | 'improve';
export type Finding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Editor reference to open (e.g. "basics/contact", "<sectionId>/<itemId>"). */
  ref?: string;
  /** Short quotes of the text concerned. */
  examples?: string[];
};
export type HealthReport = { findings: Finding[]; passed: string[] };

const has = (s: string | undefined) => !!s && s.trim().length > 0;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const quote = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const WEAK_OPENINGS =
  /^(responsible for|duties (included|include)|tasks (included|include)|worked on|helped( with)?|in charge of|involved in|assisted with|handled)\b/i;
const FIRST_PERSON = /(^|\s)(I|my|me)\s/;
const PERSONAL_DETAILS =
  /\b(date of birth|d\.o\.b|dob|marital status|religion|cnic|national id(entity)? (card )?(no|number)|passport (no|number)|father'?s name|blood group|nationality)\b/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLACEHOLDER = /\{\{\?[^}]*\}\}/;

/** Is this heading one screening software recognises for the kind (any language variant)? */
export function isStandardHeading(kind: string, title: string): boolean {
  const re = STANDARD_HEADING[kind];
  return !re || !title.trim() || re.test(title);
}

/** Words screening software expects in each section heading (any language variant we see). */
const STANDARD_HEADING: Partial<Record<string, RegExp>> = {
  experience: /experience|employment|work|career|professional|berufserfahrung|positions?/i,
  education: /education|qualification|academic|studies|training|ausbildung|schooling/i,
  skills: /skill|competenc|strength|expertise|technolog|abilities|fähigkeit|kenntnisse|tools/i,
  languages: /language|sprach/i,
  certifications: /certif|qualification|course|training|accreditation|zertifi/i,
  licences: /licen[cs]e|permit|driving/i,
  projects: /project/i,
  volunteering: /volunt|community|charity|ehrenamt/i,
  awards: /award|honou?r|achievement|recognition|auszeichnung/i,
};
const STANDARD_WORD: Record<string, string> = {
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  certifications: 'Certifications',
  licences: 'Licences',
  projects: 'Projects',
  volunteering: 'Volunteering',
  awards: 'Awards',
};

/** "2021-03" → months since year 0 (for ordering and gaps). */
function monthIndex(d: string): number | null {
  const m = d.match(/^(\d{4})(?:-(\d{2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0);
}

export function healthCheck(
  doc: ResumeDocument,
  opts: { pages?: number; now?: Date } = {},
): HealthReport {
  const f: Finding[] = [];
  const passed: string[] = [];
  const b = doc.basics;
  const sections = doc.sections.filter((s) => !s.hidden);
  const now = opts.now ?? new Date();
  const nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();

  // --- Contact ---
  if (!has(b.name))
    f.push({
      id: 'name',
      severity: 'fix',
      title: 'Add your name',
      detail: 'Your name should be the first thing an employer sees.',
      ref: 'basics/contact',
    });
  if (!has(b.email) && !has(b.phone))
    f.push({
      id: 'contact',
      severity: 'fix',
      title: 'Add a phone number or email',
      detail: 'Without contact details, an employer who likes your CV can’t reach you.',
      ref: 'basics/contact',
    });
  else {
    if (has(b.email) && !EMAIL.test(b.email.trim()))
      f.push({
        id: 'email-format',
        severity: 'fix',
        title: 'Check your email address',
        detail: 'It doesn’t look like a complete email address, so replies may not reach you.',
        ref: 'basics/contact',
        examples: [b.email],
      });
    else if (has(b.phone) && b.phone.replace(/\D/g, '').length < 7)
      f.push({
        id: 'phone-format',
        severity: 'fix',
        title: 'Check your phone number',
        detail: 'It looks too short to be a full phone number.',
        ref: 'basics/contact',
        examples: [b.phone],
      });
    else passed.push('Employers can contact you');
  }
  if (!has(b.location))
    f.push({
      id: 'location',
      severity: 'improve',
      title: 'Add your town or city',
      detail:
        'Many employers look for candidates near the job. A town or city is enough — never your full address.',
      ref: 'basics/contact',
    });

  // --- Profile ---
  const sw = words(b.summary.replace(PLACEHOLDER, ''));
  if (!has(b.summary))
    f.push({
      id: 'summary-missing',
      severity: 'improve',
      title: 'Add a short profile',
      detail:
        'Two or three sentences at the top tell an employer who you are and what you’re looking for, before they read the details.',
      ref: 'basics/summary',
    });
  else if (sw > 90)
    f.push({
      id: 'summary-long',
      severity: 'improve',
      title: 'Shorten your profile',
      detail: `Your profile is ${sw} words. Around 40–80 words is easier to read in the few seconds employers spend on the first look.`,
      ref: 'basics/summary',
    });
  else if (sw < 12)
    f.push({
      id: 'summary-short',
      severity: 'improve',
      title: 'Say a little more in your profile',
      detail: 'One more sentence about your experience or strengths helps employers place you.',
      ref: 'basics/summary',
    });
  else passed.push('Your profile is a good length');

  // --- Experience ---
  const jobs: { item: ExperienceItem; ref: string }[] = sections
    .filter((s) => s.kind === 'experience')
    .flatMap((s) =>
      (s.items as ExperienceItem[]).map((item) => ({ item, ref: `${s.id}/${item.id}` })),
    )
    .filter(({ item }) => has(item.role) || has(item.organization));

  const hasEducation = sections.some((s) => s.kind === 'education' && s.items.length > 0);
  if (!jobs.length && !hasEducation)
    f.push({
      id: 'history',
      severity: 'fix',
      title: 'Add a job or a qualification',
      detail: 'Employers need to see at least some work history or education.',
    });

  const missingDates = jobs.filter(({ item }) => !item.start && !item.end && !item.current);
  if (missingDates.length)
    f.push({
      id: 'dates-missing',
      severity: 'fix',
      title: 'Add dates to every job',
      detail:
        'Employers expect a start and end (or “present”) for each job; missing dates can look like something is hidden.',
      ref: missingDates[0]!.ref,
      examples: missingDates.map(({ item }) => item.role || item.organization),
    });
  else if (jobs.length) passed.push('Every job has dates');

  const backwards = jobs.filter(({ item }) => {
    const s = monthIndex(item.start);
    const e = monthIndex(item.end);
    return s !== null && e !== null && !item.current && e < s;
  });
  if (backwards.length)
    f.push({
      id: 'dates-order',
      severity: 'fix',
      title: 'An end date is before its start date',
      detail: 'Check the dates of this job.',
      ref: backwards[0]!.ref,
      examples: backwards.map(({ item }) => item.role),
    });

  const future = jobs.filter(({ item }) => {
    const s = monthIndex(item.start);
    return s !== null && s > nowIdx;
  });
  if (future.length)
    f.push({
      id: 'dates-future',
      severity: 'fix',
      title: 'A job starts in the future',
      detail: 'If you haven’t started yet, say so in the profile instead, or check the year.',
      ref: future[0]!.ref,
      examples: future.map(({ item }) => item.role),
    });

  // Most recent first (the order employers expect).
  const starts = jobs.map(({ item }) =>
    item.current ? nowIdx : (monthIndex(item.end) ?? monthIndex(item.start)),
  );
  const outOfOrder = starts.some(
    (v, i) => i > 0 && v !== null && starts[i - 1] !== null && v > starts[i - 1]! + 1,
  );
  if (outOfOrder)
    f.push({
      id: 'order',
      severity: 'improve',
      title: 'Put your most recent job first',
      detail:
        'Employers read from the top and expect the latest job there. Use the arrows on each job to reorder.',
      ref: jobs[0]?.ref,
    });

  const noBullets = jobs.filter(({ item }) => item.bullets.filter(has).length === 0);
  if (noBullets.length)
    f.push({
      id: 'bullets-missing',
      severity: 'improve',
      title: 'Describe what you did in each job',
      detail: 'Two to five short points per job show employers what you can do for them.',
      ref: noBullets[0]!.ref,
      examples: noBullets.map(({ item }) => item.role || item.organization),
    });

  const allBullets = jobs.flatMap(({ item, ref }) =>
    item.bullets.filter(has).map((text) => ({ text, ref })),
  );
  const weak = allBullets.filter((x) => WEAK_OPENINGS.test(x.text.trim()));
  if (weak.length)
    f.push({
      id: 'weak-openings',
      severity: 'improve',
      title: 'Start points with what you did',
      detail:
        'Phrases like “Responsible for” describe the job, not you. Starting with an action (“Led”, “Served”, “Trained”) is clearer — keep the facts the same.',
      ref: weak[0]!.ref,
      examples: weak.slice(0, 3).map((x) => quote(x.text)),
    });

  const long = allBullets.filter((x) => words(x.text) > 35);
  if (long.length)
    f.push({
      id: 'long-bullets',
      severity: 'improve',
      title: 'Shorten long points',
      detail:
        'Points over about 30 words are hard to skim. Split them, or keep the most important part.',
      ref: long[0]!.ref,
      examples: long.slice(0, 3).map((x) => quote(x.text)),
    });

  const firstPerson = allBullets.filter((x) => FIRST_PERSON.test(` ${x.text}`));
  if (firstPerson.length)
    f.push({
      id: 'first-person',
      severity: 'improve',
      title: 'Drop “I” and “my” from points',
      detail: 'CV points usually leave out “I” — “Trained new staff”, not “I trained new staff”.',
      ref: firstPerson[0]!.ref,
      examples: firstPerson.slice(0, 3).map((x) => quote(x.text)),
    });

  const seen = new Map<string, number>();
  for (const x of allBullets) {
    const k = x.text.trim().toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (dupes.length)
    f.push({
      id: 'duplicates',
      severity: 'improve',
      title: 'The same point appears more than once',
      detail:
        'Repeated points take space without adding anything. Keep each one where it matters most.',
      examples: dupes.slice(0, 3).map((d) => quote(d)),
    });

  const recent = jobs.slice(0, 2).flatMap(({ item }) => item.bullets.filter(has));
  if (recent.length >= 3 && !recent.some((t) => /\d/.test(t)))
    f.push({
      id: 'numbers',
      severity: 'improve',
      title: 'Show scale where you can',
      detail:
        'A true number — how many customers, people, deliveries, or how much money — makes a point concrete. Only add numbers you can stand behind.',
      ref: jobs[0]!.ref,
    });

  // Gaps over a year between jobs (neutral: many have good reasons).
  const spans = jobs
    .map(({ item, ref }) => ({
      s: monthIndex(item.start),
      e: item.current ? nowIdx : monthIndex(item.end),
      ref,
      role: item.role,
    }))
    .filter(
      (x): x is { s: number; e: number; ref: string; role: string } => x.s !== null && x.e !== null,
    )
    .sort((a, b) => b.s - a.s);
  for (let i = 1; i < spans.length; i++) {
    const gap = spans[i - 1]!.s - spans[i]!.e;
    if (gap > 12) {
      f.push({
        id: 'gap',
        severity: 'improve',
        title: `There’s a gap of about ${Math.round(gap / 12)} year${gap >= 24 ? 's' : ''} between jobs`,
        detail:
          'Gaps are common. If it fits, a short line (study, caring, travel, a course) answers the question before it’s asked.',
        ref: spans[i]!.ref,
      });
      break;
    }
  }

  // --- Skills ---
  const keywords = sections
    .filter((s) => s.kind === 'skills')
    .flatMap((s) => s.items.flatMap((g) => g.keywords))
    .filter(has);
  if (!keywords.length)
    f.push({
      id: 'skills-missing',
      severity: 'improve',
      title: 'Add a few skills',
      detail:
        'A short skills list helps employers — and the software many of them use — match you to the job.',
    });
  else if (keywords.length > 30)
    f.push({
      id: 'skills-many',
      severity: 'improve',
      title: 'Trim your skills list',
      detail: `You list ${keywords.length} skills. The 10–20 most relevant to the jobs you want stand out more.`,
    });
  else passed.push('You list your skills');

  // --- Whole document ---
  const allText = JSON.stringify(doc.sections) + b.summary + b.headline;
  if (PLACEHOLDER.test(allText))
    f.push({
      id: 'placeholders',
      severity: 'fix',
      title: 'Fill in the highlighted details',
      detail:
        'Some suggested sentences are waiting for a detail only you know. Fill them in or remove them before sending.',
    });

  // Screening software finds sections by their usual names (complete-studio-spec §7.6).
  const unusual = sections.filter((s) => {
    const re = STANDARD_HEADING[s.kind];
    return re && s.title.trim() && !re.test(s.title);
  });
  if (unusual.length)
    f.push({
      id: 'heading-names',
      severity: 'improve',
      title: 'Use the usual section names',
      detail: `Screening software looks for headings like “${STANDARD_WORD[unusual[0]!.kind]}”. A creative name such as “${unusual[0]!.title}” may not be recognised — rename it in the section’s menu.`,
      ref: unusual[0]!.id,
      examples: unusual.map((s) => s.title),
    });

  const personal = allText.match(PERSONAL_DETAILS);
  if (personal)
    f.push({
      id: 'personal-details',
      severity: 'improve',
      title: 'Consider removing personal details',
      detail:
        'Most employers don’t need your date of birth, marital status, religion or ID numbers at this stage, and leaving them out protects you. Include them only if the job asks.',
      examples: [personal[0]],
    });

  if (opts.pages && opts.pages > 2)
    f.push({
      id: 'length',
      severity: 'improve',
      title: `Your CV is ${opts.pages} pages`,
      detail:
        'Two pages is enough for most jobs. Older or less relevant roles can be shortened to a single line.',
    });
  else if (opts.pages) passed.push(`Your CV is ${opts.pages === 1 ? 'one page' : 'two pages'}`);

  const order: Record<Severity, number> = { fix: 0, improve: 1 };
  f.sort((a, z) => order[a.severity] - order[z.severity]);
  return { findings: f, passed };
}
