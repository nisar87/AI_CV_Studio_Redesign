import type {
  CredentialItem,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  ResumeDocument,
} from '@/modules/resume/schema';

/**
 * A CV as numbered lines for job matching and tailoring. The AI may only cite these ids as
 * evidence; the app shows the person's own text for each id, so evidence can't be invented.
 */
export type DigestLine = { id: string; text: string; ref: string };
export type Digest = {
  text: string;
  lines: Map<string, DigestLine>;
  /** Job ids → their bullet ids in CV order (for safe reordering). */
  jobs: Map<
    string,
    { itemId: string; sectionId: string; bullets: { id: string; index: number }[] }
  >;
  skills: string[];
};

const range = (s: string, e: string, current?: boolean) =>
  s || e || current ? ` (${s || '?'} to ${current ? 'now' : e || '?'})` : '';

export function profileDigest(doc: ResumeDocument): Digest {
  const out: string[] = [];
  const lines = new Map<string, DigestLine>();
  const jobs: Digest['jobs'] = new Map();
  const skills: string[] = [];
  const add = (id: string, text: string, ref: string) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return;
    lines.set(id, { id, text: t, ref });
    out.push(`${id}: ${t}`);
  };
  const b = doc.basics;
  if (b.name) out.push(`NAME: ${b.name}`);
  add('HEADLINE', b.headline, 'basics/contact');
  add('SUMMARY', b.summary, 'basics/summary');

  let j = 0;
  let v = 0;
  let e = 0;
  let c = 0;
  let p = 0;
  let o = 0;
  for (const s of doc.sections) {
    if (s.hidden) continue;
    if (
      s.kind === 'experience' ||
      s.kind === 'volunteering' ||
      s.kind === 'internships' ||
      s.kind === 'military'
    ) {
      for (const it of s.items as ExperienceItem[]) {
        const id = s.kind === 'volunteering' ? `V${++v}` : `J${++j}`;
        const ref = `${s.id}/${it.id}`;
        add(
          id,
          `${it.role}${it.organization ? ` — ${it.organization}` : ''}${it.location ? `, ${it.location}` : ''}${range(it.start, it.end, it.current)}`,
          ref,
        );
        const bullets: { id: string; index: number }[] = [];
        it.bullets.forEach((t, i) => {
          if (!t.trim()) return;
          const bid = `${id}.B${i + 1}`;
          add(bid, t, ref);
          bullets.push({ id: bid, index: i });
        });
        jobs.set(id, { itemId: it.id, sectionId: s.id, bullets });
      }
    } else if (s.kind === 'education') {
      for (const it of s.items as EducationItem[]) {
        const id = `EDU${++e}`;
        const ref = `${s.id}/${it.id}`;
        add(
          id,
          `${it.qualification}${it.institution ? ` — ${it.institution}` : ''}${range(it.start, it.end)}`,
          ref,
        );
        it.details.forEach((t, i) => add(`${id}.D${i + 1}`, t, ref));
      }
    } else if (s.kind === 'skills') {
      for (const g of s.items) skills.push(...g.keywords.filter(Boolean));
    } else if (s.kind === 'languages') {
      const langs = s.items
        .map((l) => `${l.language}${l.fluency ? ` (${l.fluency})` : ''}`)
        .filter(Boolean);
      if (langs.length) add('LANG', langs.join('; '), `${s.id}/${s.items[0]?.id ?? ''}`);
    } else if (
      s.kind === 'certifications' ||
      s.kind === 'licences' ||
      s.kind === 'awards' ||
      s.kind === 'courses' ||
      s.kind === 'memberships' ||
      s.kind === 'publications' ||
      s.kind === 'conferences' ||
      s.kind === 'patents'
    ) {
      for (const it of s.items as CredentialItem[])
        add(
          `CERT${++c}`,
          `${it.name}${it.issuer ? ` — ${it.issuer}` : ''}${it.date ? ` (${it.date})` : ''}${it.detail ? `: ${it.detail}` : ''}`,
          `${s.id}/${it.id}`,
        );
    } else if (s.kind === 'projects') {
      for (const it of s.items as ProjectItem[]) {
        const id = `PROJ${++p}`;
        const ref = `${s.id}/${it.id}`;
        add(id, `${it.name}${it.role ? ` — ${it.role}` : ''}`, ref);
        it.bullets.forEach((t, i) => add(`${id}.B${i + 1}`, t, ref));
      }
    } else if (s.kind === 'strengths') {
      for (const it of s.items)
        add(`OTHER${++o}`, [it.title, it.text].filter(Boolean).join(': '), `${s.id}/${it.id}`);
    } else if (s.kind === 'interests') {
      const all = s.items.flatMap((g) => g.keywords).filter(Boolean);
      if (all.length)
        add(`OTHER${++o}`, `Interests: ${all.join('; ')}`, `${s.id}/${s.items[0]!.id}`);
    } else if (s.kind === 'custom' || s.kind === 'achievements') {
      for (const it of s.items) {
        const id = `OTHER${++o}`;
        const ref = `${s.id}/${it.id}`;
        add(id, [it.title, it.subtitle].filter(Boolean).join(' — ') || s.title, ref);
        it.bullets.forEach((t, i) => add(`${id}.B${i + 1}`, t, ref));
      }
    }
  }
  if (skills.length) {
    const sk = doc.sections.find((s) => s.kind === 'skills' && !s.hidden);
    add('SKILLS', skills.join('; '), sk ? `${sk.id}/${sk.items[0]?.id ?? ''}` : '');
  }
  return { text: out.join('\n'), lines, jobs, skills };
}

/** Plain text of a CV (for "is this keyword in my CV?"). */
export const digestPlain = (d: Digest) => [...d.lines.values()].map((l) => l.text).join('\n');
