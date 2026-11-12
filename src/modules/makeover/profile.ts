import type { PresetId } from '@/modules/resume/professions';
import type { ResumeDocument } from '@/modules/resume/schema';

/**
 * Profession and seniority (spec §6.2 step 7, "rules first"): a weighted keyword count over the
 * headline, job titles and summary. No AI call; cheap, explainable and testable.
 */
const WORDS: [PresetId, RegExp][] = [
  [
    'driver',
    /\b(driv(er|ing)|deliver(y|ies)|courier|van|truck|lorry|hgv|lgv|taxi|chauffeur|forklift|dispatch rider)\b/g,
  ],
  [
    'teacher',
    /\b(teach(er|ing)?|tutor|school|classroom|lecturer|nursery|teaching assistant|curriculum|pupils?|students)\b/g,
  ],
  [
    'healthcare',
    /\b(nurs(e|ing)|carer|care (worker|assistant)|healthcare|clinic(al)?|hospital|pharmac(y|ist)|midwife|doctor|patients?|ward|physiotherap\w*)\b/g,
  ],
  [
    'retail',
    /\b(shop|retail|cashier|waiter|waitress|barista|caf[eé]|hotel|front desk|sales assistant|store|customers?|hospitality|restaurant)\b/g,
  ],
  [
    'trades',
    /\b(electrician|plumb(er|ing)|builder|construction|mechanic|carpent(er|ry)|welder|welding|joiner|technician|site|maintenance|hvac|fitter)\b/g,
  ],
  [
    'tech',
    /\b(developer|software|engineer(ing)?|programm(er|ing)|it support|data|devops|web|cloud|frontend|backend|full[- ]stack|typescript|python|java)\b/g,
  ],
  [
    'office',
    /\b(admin(istrat\w*)?|office|accounts?|accountant|bookkeep\w*|customer service|secretary|receptionist|clerk|sales officer|payroll|hr|coordinator)\b/g,
  ],
  [
    'executive',
    /\b(director|head of|chief|executive|ceo|cfo|coo|cto|vp|vice president|senior manager|general manager|managing)\b/g,
  ],
  [
    'student',
    /\b(student|graduate|school leaver|intern(ship)?|apprentice(ship)?|undergraduate)\b/g,
  ],
];

export type Profile = {
  presetId: PresetId;
  /** Years since the earliest job start (0 when there are no dated jobs). */
  years: number;
  seniority: 'entry' | 'mid' | 'senior';
};

export function detectProfile(doc: ResumeDocument, now = new Date()): Profile {
  const jobs = doc.sections.flatMap((s) => (s.kind === 'experience' ? s.items : []));
  const weighted: [string, number][] = [
    [doc.basics.headline, 3],
    ...jobs.map((j) => [j.role, 2] as [string, number]),
    [doc.basics.summary, 1],
    ...jobs.slice(0, 3).map((j) => [j.bullets.join(' '), 0.5] as [string, number]),
  ];
  const score = new Map<PresetId, number>();
  for (const [text, w] of weighted) {
    const t = text.toLowerCase();
    for (const [id, re] of WORDS) {
      const n = t.match(re)?.length ?? 0;
      if (n) score.set(id, (score.get(id) ?? 0) + n * w);
    }
  }
  const years = yearsSince(jobs.map((j) => j.start).filter(Boolean), now);
  let presetId: PresetId = 'general';
  let best = 0;
  for (const [id] of WORDS) {
    const s = score.get(id) ?? 0;
    if (s > best) {
      best = s;
      presetId = id;
    }
  }
  if (presetId === 'general' && years === 0 && hasEducationOnly(doc)) presetId = 'student';
  const seniority =
    years >= 10 || presetId === 'executive' ? 'senior' : years >= 3 ? 'mid' : 'entry';
  return { presetId, years, seniority };
}

function yearsSince(starts: string[], now: Date) {
  const ys = starts.map((s) => Number(s.slice(0, 4))).filter((y) => y > 1950);
  if (!ys.length) return 0;
  return Math.max(0, now.getFullYear() - Math.min(...ys));
}

function hasEducationOnly(doc: ResumeDocument) {
  return doc.sections.some((s) => s.kind === 'education' && s.items.length > 0);
}
