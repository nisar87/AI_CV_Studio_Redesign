import { contentWords, COVERAGE_TARGET, documentText } from '@/modules/import/coverage';
import { parseCv } from '@/modules/import/parse';
import type { TaskOutput } from '@/modules/ai/schemas';
import { migrateV1 } from '@/modules/design/catalogue';
import { digestPlain, type Digest } from '@/modules/jobs/digest';
import { cvHasTerm } from '@/modules/jobs/match';
import { isStandardHeading } from './health';
import type { ExperienceItem, ResumeDocument } from '@/modules/resume/schema';

/**
 * ATS check (complete-studio-spec §10, R8): what an applicant-tracking system is likely to read
 * from the PDF we make. We read our own PDF back with the same importer people use for their
 * old CVs, then report a clear pass / needs work per check with a specific fix. No single score.
 */
export type AtsStatus = 'pass' | 'needs-work' | 'info';
export type AtsCheck = {
  id: 'readable' | 'contact' | 'jobs' | 'order' | 'headings' | 'layout' | 'length';
  title: string;
  status: AtsStatus;
  detail: string;
  /** What to do about it (needs-work and info only). */
  fix?: string;
  /** Where to fix it: 'design' for the Design tab, or an editor ref ("<sectionId>/<itemId>"). */
  where?: string;
  examples?: string[];
};
export type AtsKeywords = {
  jobTitle: string;
  present: string[];
  /** Missing terms; `line` is the person's own line that shows it in other words, if any. */
  missing: { term: string; line?: { text: string; ref: string } }[];
};
export type AtsReport = {
  at: string;
  checks: AtsCheck[];
  /** Premium with a job: which of the advert's terms the CV uses. */
  keywords?: AtsKeywords;
  /** What we read, first lines, so the person can see it for themselves. */
  sample: string[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9@.+]+/g, ' ')
    .trim();

const visible = (doc: ResumeDocument) => doc.sections.filter((s) => !s.hidden && s.items.length);
const jobsOf = (doc: ResumeDocument) =>
  doc.sections
    .filter((s) => !s.hidden && s.kind === 'experience')
    .flatMap((s) => (s.items as ExperienceItem[]).map((it) => ({ it, sectionId: s.id })));

/** Checks from the text read back out of the PDF (pure; unit-tested without a browser). */
export function assessReadBack(
  src: ResumeDocument,
  lines: string[],
  opts: { pages: number },
): AtsCheck[] {
  const checks: AtsCheck[] = [];
  const { doc: back, report } = parseCv(lines);
  const joined = norm(lines.join('\n'));
  const spec = src.design.v2 ?? migrateV1(src.design);
  const columns = spec.layout.type !== 'single' && spec.layout.type !== 'timeline';
  const ats = !!spec.atsSafe;
  const switchFix = ats
    ? undefined
    : 'Turn on “ATS-safe version” in the Design tab before downloading for online applications. Your other choices come back when you turn it off.';

  // 1. Readable: the person's words come back out of the PDF as text (whatever the structure).
  const have = new Set(contentWords(lines.join('\n')));
  const srcLines = documentText(src).split('\n');
  const want = new Set(srcLines.flatMap(contentWords));
  let found = 0;
  for (const w of want) if (have.has(w)) found++;
  const cov = {
    ratio: want.size ? found / want.size : 1,
    missing: srcLines.filter((l) => contentWords(l).some((w) => !have.has(w))),
  };
  checks.push(
    cov.ratio >= COVERAGE_TARGET
      ? {
          id: 'readable',
          title: 'Your text can be read',
          status: 'pass',
          detail: `We read ${Math.round(cov.ratio * 100)}% of your words back out of the PDF, the way screening software does.`,
        }
      : {
          id: 'readable',
          title: 'Some text may not be read',
          status: 'needs-work',
          detail: `Only ${Math.round(cov.ratio * 100)}% of your words came back out of the PDF.`,
          fix: switchFix ?? 'Avoid special characters and symbols in place of words.',
          where: 'design',
          examples: cov.missing.slice(0, 3),
        },
  );

  // 2. Contact details are found as text.
  const missingContact = [
    src.basics.name && !joined.includes(norm(src.basics.name)) ? 'your name' : '',
    src.basics.email && !(report.email && joined.includes(norm(src.basics.email))) ? 'email' : '',
    src.basics.phone && !report.phone ? 'phone number' : '',
  ].filter(Boolean);
  const noContact = !src.basics.email && !src.basics.phone;
  checks.push(
    noContact
      ? {
          id: 'contact',
          title: 'Add an email or phone number',
          status: 'needs-work',
          detail: 'Employers and their systems need a way to contact you.',
          fix: 'Add your email and phone in “About you”.',
          where: 'basics/contact',
        }
      : missingContact.length
        ? {
            id: 'contact',
            title: 'Contact details not found',
            status: 'needs-work',
            detail: `We couldn’t read ${missingContact.join(' and ')} from the PDF.`,
            fix: switchFix ?? 'Write them as plain text, one item each.',
            where: switchFix ? 'design' : 'basics/contact',
          }
        : {
            id: 'contact',
            title: 'Name and contact details found',
            status: 'pass',
            detail: 'Your name, email and phone number read as plain text.',
          },
  );

  // 3. Every employer and job title comes back.
  const jobs = jobsOf(src);
  const backJobs = jobsOf(back).map(({ it }) => norm(`${it.role} ${it.organization}`));
  const lost = jobs.filter(
    ({ it }) =>
      it.organization &&
      !backJobs.some((b) => b.includes(norm(it.organization))) &&
      !joined.includes(norm(it.organization)),
  );
  if (jobs.length)
    checks.push(
      lost.length
        ? {
            id: 'jobs',
            title: 'Some jobs may be missed',
            status: 'needs-work',
            detail: `We couldn’t read ${lost.length === 1 ? 'one employer' : `${lost.length} employers`} back as a job.`,
            fix: switchFix ?? 'Put the job title and employer on their own line.',
            where: switchFix ? 'design' : `${lost[0]!.sectionId}/${lost[0]!.it.id}`,
            examples: lost.slice(0, 3).map(({ it }) => `${it.role} — ${it.organization}`),
          }
        : {
            id: 'jobs',
            title: 'Every job is read',
            status: 'pass',
            detail: `All ${jobs.length} job${jobs.length === 1 ? '' : 's'} came back with title and employer.`,
          },
    );

  // 4. Reading order: sections and jobs come back in the order you wrote them.
  // Each section's first distinctive line (at least 8 characters, so common words don't match).
  const firsts = visible(src)
    .map((s) => {
      const first = s.items[0] as unknown as Record<string, unknown>;
      const list = (k: string) => (Array.isArray(first[k]) ? (first[k] as string[])[0] : '');
      const probe = norm(
        String(
          first.role ||
            first.qualification ||
            first.name ||
            first.title ||
            first.language ||
            first.label ||
            first.text ||
            list('bullets') ||
            list('keywords') ||
            '',
        ),
      ).slice(0, 40);
      return { title: s.title, at: probe.length >= 8 ? joined.indexOf(probe) : -1 };
    })
    .filter((x) => x.at >= 0);
  const outOfOrder = firsts.find((x, i) => i > 0 && x.at < firsts[i - 1]!.at);
  const bulletProblem = (() => {
    if (jobs.length < 2) return null;
    const a = jobs[0]!.it;
    const b = jobs[1]!.it;
    const bullet = a.bullets.find((x) => x.trim());
    if (!bullet || !b.role) return null;
    const pb = joined.indexOf(norm(bullet).slice(0, 40));
    const pr = joined.indexOf(norm(b.role), joined.indexOf(norm(a.role)) + 1);
    return pb >= 0 && pr >= 0 && pb > pr ? `${a.role}: its points are read after ${b.role}` : null;
  })();
  checks.push(
    outOfOrder || bulletProblem
      ? {
          id: 'order',
          title: 'Reading order is mixed up',
          status: 'needs-work',
          detail: bulletProblem
            ? `Software reads your CV in a different order: ${bulletProblem}.`
            : `Software reads “${outOfOrder!.title}” before sections that come first on the page.`,
          fix: switchFix ?? 'Move sections so the most important come first.',
          where: 'design',
        }
      : {
          id: 'order',
          title: 'Reading order is right',
          status: 'pass',
          detail: 'Sections, jobs and their points are read in the order you wrote them.',
        },
  );

  // 5. Section headings software recognises (the same rule as the CV health check).
  const odd = visible(src).filter((s) => !isStandardHeading(s.kind, s.title));
  checks.push(
    odd.length
      ? {
          id: 'headings',
          title: 'Some headings aren’t recognised',
          status: 'needs-work',
          detail: 'Screening software looks for the usual section names.',
          fix: `Rename ${odd
            .slice(0, 3)
            .map((s) => `“${s.title}”`)
            .join(', ')} to a usual name, such as “Work experience”, “Education” or “Skills”.`,
          where: `${odd[0]!.id}`,
          examples: odd.map((s) => s.title),
        }
      : {
          id: 'headings',
          title: 'Section headings are recognised',
          status: 'pass',
          detail: 'Each section is found under the name software expects.',
        },
  );

  // 6. Layout: columns, photo and icons are fine for people, riskier for older systems.
  const extras = [
    columns ? 'more than one column' : '',
    src.basics.photo && spec.header.photo.show ? 'a photo' : '',
  ].filter(Boolean);
  checks.push(
    ats
      ? {
          id: 'layout',
          title: 'ATS-safe version is on',
          status: 'pass',
          detail: 'One plain column with standard headings: the safest layout for online forms.',
        }
      : extras.length
        ? {
            id: 'layout',
            title: 'Layout: fine to read, safer as ATS-safe',
            status: 'info',
            detail: `This design has ${extras.join(' and ')}. We read it correctly, but some older systems mix columns or skip photos.`,
            fix: switchFix,
            where: 'design',
          }
        : {
            id: 'layout',
            title: 'Simple layout',
            status: 'pass',
            detail: 'One column, no photo: easy for any system to read.',
          },
  );

  // 7. Length.
  checks.push(
    opts.pages <= 2
      ? {
          id: 'length',
          title: `${opts.pages} page${opts.pages === 1 ? '' : 's'}`,
          status: 'pass',
          detail: 'A good length for most applications.',
        }
      : {
          id: 'length',
          title: `${opts.pages} pages`,
          status: 'info',
          detail: 'Most employers expect one or two pages, unless the role is senior or academic.',
          fix: 'Try “Fit to one page” in the Design tab, or shorten older jobs.',
          where: 'design',
        },
  );
  return checks;
}

/** Keyword analysis from the AI's terms, re-checked against the CV here. */
export function checkKeywords(
  out: TaskOutput<'quality.atsKeywords'>,
  digest: Digest,
  jobTitle: string,
): AtsKeywords {
  const plain = digestPlain(digest);
  const seen = new Set<string>();
  const present: string[] = [];
  const missing: AtsKeywords['missing'] = [];
  for (const t of out.terms) {
    const term = t.term.trim();
    const k = term.toLowerCase();
    if (!term || seen.has(k)) continue;
    seen.add(k);
    if (cvHasTerm(plain, term)) present.push(term);
    else {
      const line = digest.lines.get(t.line.trim());
      missing.push(line ? { term, line: { text: line.text, ref: line.ref } } : { term });
    }
  }
  return { jobTitle, present, missing };
}
