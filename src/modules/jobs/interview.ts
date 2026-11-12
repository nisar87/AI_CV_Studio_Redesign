import type { TaskOutput } from '@/modules/ai/schemas';
import type { Digest } from './digest';

export type InterviewKind = TaskOutput<'interview.prep'>['questions'][number]['kind'];
export type InterviewPrep = {
  at: string;
  sourceTitle: string;
  questions: {
    question: string;
    kind: InterviewKind;
    why: string;
    points: string[];
    /** CV lines the notes come from, in the person's own words, with an editor link ref. */
    evidence: { text: string; ref: string }[];
  }[];
  tips: string[];
};

/** Resolves cited CV line ids to the person's own text and drops ids that are not in the CV. */
export function checkInterview(
  out: TaskOutput<'interview.prep'>,
  digest: Digest,
  opts: { sourceTitle: string; now?: Date },
): InterviewPrep {
  return {
    at: (opts.now ?? new Date()).toISOString(),
    sourceTitle: opts.sourceTitle,
    questions: out.questions.map((q) => ({
      question: q.question,
      kind: q.kind,
      why: q.why,
      points: q.points.filter((p) => p.trim()),
      evidence: [...new Set(q.evidence.map((e) => e.trim()))]
        .map((id) => digest.lines.get(id))
        .filter((l): l is NonNullable<typeof l> => !!l)
        .map((l) => ({ text: l.text, ref: l.ref })),
    })),
    tips: out.tips.filter((t) => t.trim()),
  };
}
