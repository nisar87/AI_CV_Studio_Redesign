import type { TaskOutput } from '@/modules/ai/schemas';
import { cvFromProfile } from '@/modules/resume/profile';
import type { ExperienceItem, ResumeDocument } from '@/modules/resume/schema';
import { digestPlain, type Digest } from './digest';

/**
 * Job match and tailoring checks (Release 2). The AI proposes; these pure functions decide what
 * is shown or saved: evidence must be real CV lines, keywords are checked against the CV, and
 * tailoring only reorders the person's own facts.
 */
export type MatchResult = {
  at: string;
  sourceTitle: string;
  summary: string;
  requirements: {
    text: string;
    importance: 'must' | 'nice';
    status: 'met' | 'partial' | 'missing';
    evidence: { text: string; ref: string }[];
    note: string;
  }[];
  keywords: { term: string; found: boolean }[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();

/** A rough word stem: British/American spelling and common endings (for matching only). */
export function stem(word: string): string {
  let w = word.replace(/isation(s?)$/, 'ization$1').replace(/is(e|ed|es|ing)$/, 'iz$1');
  for (const suf of ['ions', 'ion', 'ings', 'ing', 'ed', 'es', 's', 'e'])
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      w = w.slice(0, -suf.length);
      break;
    }
  return w;
}

/** Is this term in the CV (whole words, case-insensitive; plurals tolerated)? */
export function cvHasTerm(plain: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  const text = ` ${norm(plain)} `;
  if (text.includes(` ${t} `)) return true;
  // "deliveries" ~ "delivery", "drivers" ~ "driver", "boxes" ~ "box"; "tuning" ~ "tune",
  // "validation" ~ "validate", "optimisation" ~ "optimization".
  const forms = (w: string) => [w, `${w}s`, `${w}es`, w.replace(/y$/, 'ies')];
  const same = (a: string, b: string) =>
    forms(a).includes(b) || forms(b).includes(a) || stem(a) === stem(b);
  const cv = text.split(' ').filter(Boolean);
  return t.split(' ').every((w) => w.length > 2 && cv.some((x) => same(x, w)));
}

/** Digest lines that are self-description rather than evidence. */
const SELF_DESCRIBED = new Set(['NAME', 'HEADLINE', 'SUMMARY']);

export function checkMatch(
  out: TaskOutput<'job.match'>,
  digest: Digest,
  opts: { sourceTitle: string; now?: Date },
): MatchResult {
  const plain = digestPlain(digest);
  const requirements = out.requirements.map((r) => {
    const ids = [...new Set(r.evidence.map((e) => e.trim()))].filter((id) => digest.lines.has(id));
    const evidence = ids
      .map((id) => digest.lines.get(id)!)
      .map((l) => ({ text: l.text, ref: l.ref }));
    // "Met" needs real evidence: a job, qualification, certificate, skill… A headline or summary
    // is the person describing themselves, so on its own it only counts as "partly".
    const solid = ids.some((id) => !SELF_DESCRIBED.has(id));
    const status = r.status === 'met' && !solid ? 'partial' : r.status;
    return {
      text: r.text,
      importance: r.importance,
      status,
      evidence: status === 'missing' ? [] : evidence,
      note: r.note,
    };
  });
  const seen = new Set<string>();
  const keywords = out.keywords
    .map((k) => k.trim())
    .filter((k) => k && !seen.has(norm(k)) && seen.add(norm(k)))
    .map((term) => ({ term, found: cvHasTerm(plain, term) }));
  return {
    at: (opts.now ?? new Date()).toISOString(),
    sourceTitle: opts.sourceTitle.slice(0, 120),
    summary: out.summary,
    requirements,
    keywords,
  };
}

/**
 * A copy of the profile arranged for one job: AI summary and headline (already truth-guarded),
 * bullets reordered within each job (none added or removed), skills reordered.
 */
export function applyTailor(
  profile: ResumeDocument,
  out: TaskOutput<'job.tailor'>,
  digest: Digest,
  job: { id: string; title: string; company: string },
  now = new Date(),
): ResumeDocument {
  const doc = cvFromProfile(profile, {
    jobId: job.id,
    title: `${profile.basics.name || 'CV'} — ${job.title}${job.company ? ` (${job.company})` : ''}`,
    now,
  });
  if (out.summary.trim()) doc.basics.summary = out.summary.trim();
  if (out.headline.trim()) doc.basics.headline = out.headline.trim();

  for (const o of out.order) {
    const j = digest.jobs.get(o.job);
    if (!j) continue;
    const section = doc.sections.find((s) => s.id === j.sectionId);
    const item = section?.items.find((i) => i.id === j.itemId) as ExperienceItem | undefined;
    if (!item) continue;
    const byId = new Map(j.bullets.map((b) => [b.id, item.bullets[b.index]!]));
    const ordered = [...new Set(o.bullets)].filter((id) => byId.has(id));
    // Anything the model left out keeps its place at the end — never drop a fact.
    for (const b of j.bullets) if (!ordered.includes(b.id)) ordered.push(b.id);
    const empty = item.bullets.filter((t) => !t.trim());
    item.bullets = [...ordered.map((id) => byId.get(id)!), ...empty];
  }

  if (out.skills.length) {
    const wanted = out.skills.map(norm);
    for (const s of doc.sections) {
      if (s.kind !== 'skills') continue;
      for (const g of s.items) {
        const rank = (k: string) => {
          const i = wanted.indexOf(norm(k));
          return i === -1 ? wanted.length : i;
        };
        // Levels move with their keyword.
        const sorted = g.keywords
          .map((k, i) => ({ k, i, l: g.levels?.[i] ?? 0 }))
          .sort((a, b) => rank(a.k) - rank(b.k) || a.i - b.i);
        g.keywords = sorted.map((x) => x.k);
        if (g.levels) g.levels = sorted.map((x) => x.l);
      }
    }
  }
  return doc;
}
