import { z } from 'zod';
import type { TaskOutput } from '@/modules/ai/schemas';
import type { Digest } from '@/modules/jobs/digest';

/**
 * Skill gap and learning plan (R9.4, complete-studio-spec §10.3): for a target role or a tracked
 * job, the skills the CV shows, those it partly shows or lacks, and what to learn first. Kept in the
 * account at users/{uid}/skillPlans/{id} with the person's progress on each step.
 */
export const MAX_PLANS = 10;

export const STEP_STATUS = ['todo', 'learning', 'done'] as const;
export type StepStatus = (typeof STEP_STATUS)[number];

export type GapSkill = {
  name: string;
  importance: 'core' | 'useful';
  status: 'have' | 'partly' | 'missing';
  /** The person's own CV lines that show it (resolved by the app, never written by the AI). */
  evidence: { text: string; ref: string }[];
  note: string;
};
export type GapStep = {
  skill: string;
  why: string;
  how: string;
  proof: string;
  weeks: number;
  status: StepStatus;
};
export type SkillPlan = {
  id: string;
  role: string;
  /** Tracked job it was made for ('' for a typed role). */
  jobId: string;
  /** CV it was read from (for "Show me" links). */
  documentId: string;
  summary: string;
  skills: GapSkill[];
  plan: GapStep[];
  createdAt: string;
  updatedAt: string;
};

/** PUT body: progress on the steps, by index. */
export const progressInput = z.object({
  steps: z.array(z.enum(STEP_STATUS)).max(5),
});

/** Lines that are the person describing themselves; alone they don't prove a skill. */
const SELF_DESCRIBED = new Set(['NAME', 'HEADLINE', 'SUMMARY']);
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const noLinks = (s: string) =>
  s
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Checks the AI's answer against the CV: evidence must be real CV lines; "have" needs evidence
 * beyond the headline or summary (else "partly"); "partly" with no evidence is "missing". The plan
 * keeps only steps for skills still to learn, without links, in order, with sane week counts.
 */
export function checkGap(
  out: TaskOutput<'skills.gap'>,
  digest: Digest,
): Pick<SkillPlan, 'summary' | 'skills' | 'plan'> {
  const seen = new Set<string>();
  const skills: GapSkill[] = out.skills
    .filter((s) => s.name.trim() && !seen.has(key(s.name)) && seen.add(key(s.name)))
    .map((s) => {
      const ids = [...new Set(s.evidence.map((e) => e.trim()))].filter((id) =>
        digest.lines.has(id),
      );
      const solid = ids.some((id) => !SELF_DESCRIBED.has(id));
      let status = s.status;
      if (status === 'have' && !solid) status = ids.length ? 'partly' : 'missing';
      if (status === 'partly' && !ids.length) status = 'missing';
      return {
        name: s.name.trim(),
        importance: s.importance,
        status,
        evidence:
          status === 'missing'
            ? []
            : ids.map((id) => digest.lines.get(id)!).map((l) => ({ text: l.text, ref: l.ref })),
        note: s.note.trim(),
      };
    });
  const toLearn = new Map(
    skills.filter((s) => s.status !== 'have').map((s) => [key(s.name), s.name]),
  );
  const planned = new Set<string>();
  const plan: GapStep[] = out.plan
    .filter(
      (p) => toLearn.has(key(p.skill)) && !planned.has(key(p.skill)) && planned.add(key(p.skill)),
    )
    .slice(0, 5)
    .map((p) => ({
      skill: toLearn.get(key(p.skill))!,
      why: noLinks(p.why),
      how: noLinks(p.how),
      proof: noLinks(p.proof),
      weeks: Math.min(26, Math.max(1, Math.round(p.weeks))),
      status: 'todo' as const,
    }));
  return { summary: out.summary.trim(), skills, plan };
}

/** Progress on a plan: done steps out of all steps. */
export const progressOf = (p: Pick<SkillPlan, 'plan'>) => ({
  done: p.plan.filter((s) => s.status === 'done').length,
  total: p.plan.length,
});
