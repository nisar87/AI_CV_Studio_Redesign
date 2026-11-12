import 'server-only';
import { buildSource, derivedYears, guardText } from './guard';
import type { AiProvider } from './provider';
import { runTask } from './run';

type Models = { fast: string; smart: string };
import type { TaskId } from './schemas';
import * as F from '@/modules/resume/fixtures';
import type { ResumeDocument } from '@/modules/resume/schema';

/**
 * The live AI evaluation set (roadmap Phase 4 acceptance; launch gate R1.6): every writing task
 * over the profession fixtures, messy notes and the brief's two examples. Shared by
 * `npm run ai:eval` and the Admin Console (which runs it on the server, where Gemini is reachable).
 */
export type EvalSample = {
  name: string;
  task: TaskId;
  input: Record<string, unknown>;
  sourceTexts: string[];
  years?: number[];
};
export function evalSamples(): EvalSample[] {
  const samples: EvalSample[] = [];

  const docs: ResumeDocument[] = [
    F.driver,
    F.teacher,
    F.nurse,
    F.graduate,
    F.engineer,
    F.executive,
  ];
  for (const doc of docs) {
    const jobs = doc.sections
      .filter((s) => s.kind === 'experience')
      .flatMap(
        (s) =>
          s.items as {
            role: string;
            organization: string;
            start: string;
            end: string;
            current: boolean;
            bullets: string[];
          }[],
      );
    const skills = doc.sections
      .filter((s) => s.kind === 'skills')
      .flatMap((s) => (s.items as { keywords: string[] }[]).flatMap((g) => g.keywords));
    const education = doc.sections
      .filter((s) => s.kind === 'education' || s.kind === 'certifications' || s.kind === 'licences')
      .flatMap((s) =>
        (s.items as Record<string, string>[]).map((i) =>
          [i.qualification ?? i.name, i.institution ?? i.issuer].filter(Boolean).join(', '),
        ),
      );
    const job = jobs.find((j) => j.bullets.length > 0);
    const jobsIn = jobs.slice(0, 6).map(({ role, organization, start, end, current, bullets }) => ({
      role,
      organization,
      start,
      end,
      current,
      bullets,
    }));
    const allText = [
      doc.basics.headline,
      doc.basics.summary,
      ...jobs.flatMap((j) => [j.role, j.organization, j.start, j.end, ...j.bullets]),
      ...skills,
      ...education,
    ];

    samples.push({
      name: `${doc.presetId}: profile (write)`,
      task: 'write.summary',
      input: {
        presetId: doc.presetId,
        headline: doc.basics.headline,
        mode: 'write',
        experience: jobsIn,
        education,
        skills,
      },
      sourceTexts: allText.filter((t) => t !== doc.basics.summary),
      years: derivedYears(jobsIn),
    });
    if (doc.basics.summary)
      samples.push({
        name: `${doc.presetId}: profile (shorter)`,
        task: 'write.summary',
        input: {
          presetId: doc.presetId,
          headline: doc.basics.headline,
          mode: 'shorter',
          currentSummary: doc.basics.summary,
          experience: jobsIn,
          education,
          skills,
        },
        sourceTexts: allText,
        years: derivedYears(jobsIn),
      });
    if (job) {
      for (const instruction of ['clearer', 'shorter', 'professional'] as const)
        samples.push({
          name: `${doc.presetId}: bullets (${instruction})`,
          task: 'write.improveBullets',
          input: {
            presetId: doc.presetId,
            role: job.role,
            organization: job.organization,
            bullets: job.bullets,
            instruction,
          },
          sourceTexts: [job.role, job.organization, ...job.bullets],
        });
      samples.push({
        name: `${doc.presetId}: bullets from notes`,
        task: 'write.fromNotes',
        input: {
          presetId: doc.presetId,
          role: job.role,
          organization: job.organization,
          notes: job.bullets.join('. ').toLowerCase(),
        },
        sourceTexts: [job.role, job.organization, ...job.bullets],
      });
    }
    samples.push({
      name: `${doc.presetId}: skills`,
      task: 'suggest.skills',
      input: {
        presetId: doc.presetId,
        headline: doc.basics.headline,
        experience: jobs.map((j) => [j.role, ...j.bullets].join('. ').slice(0, 400)),
        existing: skills,
      },
      sourceTexts: [],
    });
  }
  // Rough, realistic notes from people with little writing confidence.
  for (const [presetId, notes] of [
    [
      'driver',
      'i drive van for amazon flex about 3 years, do around 100 drops a day, never had accident',
    ],
    [
      'retail',
      'worked at tesco on tills and stacking shelfs, helped customers find stuff, did cash up at night',
    ],
    [
      'healthcare',
      'care assistant in nursing home, help residents wash and dress, give meals, talk with familys',
    ],
  ] as const)
    samples.push({
      name: `${presetId}: messy notes`,
      task: 'write.fromNotes',
      input: { presetId, notes },
      sourceTexts: [notes],
    });

  const briefExamples = [
    'I am a school teacher, I want a CV that is modern, blue, clean and elegant',
    'A simple CV for a delivery driver',
  ];
  for (const description of briefExamples) {
    samples.push({
      name: `intake: ${description}`,
      task: 'intake.interpret',
      input: { description },
      sourceTexts: [],
    });
  }
  samples.push({
    name: 'design: modern, blue, clean and elegant',
    task: 'design.interpret',
    input: { description: 'modern, blue, clean and elegant', presetId: 'teacher' },
    sourceTexts: [],
  });

  return samples;
}

/** Independent check: unmarked numbers or credentials in the final text that are not in the input. */
export function residual(text: string, s: EvalSample): string[] {
  const unmarked = text.replace(/\{\{\?[^{}]*\}\}/g, ' ');
  const r = guardText(unmarked, buildSource(s.sourceTexts, s.years ?? []));
  return r.findings.filter((f) => f.kind !== 'name').map((f) => `${f.kind}: ${f.value}`);
}

export type EvalResult = {
  index: number;
  name: string;
  task: TaskId;
  ok: boolean;
  error?: string;
  output?: unknown;
  /** Facts the model added that the guard replaced with {{?…}} markers. */
  caught: string[];
  /** Unmarked new facts left after the guard — must be empty. */
  residual: string[];
  ms: number;
};

export async function runEvalSample(
  index: number,
  deps: { provider: AiProvider; models: Models },
): Promise<EvalResult> {
  const s = evalSamples()[index];
  if (!s) throw new Error('No such sample');
  const t0 = Date.now();
  const r = await runTask(s.task, s.input, 0, { ...deps, timeoutMs: 45_000 });
  const ms = Date.now() - t0;
  if (!r.ok)
    return {
      index,
      name: s.name,
      task: s.task,
      ok: false,
      error: `${r.code}: ${r.reason}`,
      caught: [],
      residual: [],
      ms,
    };
  const texts =
    'text' in r.result ? [r.result.text] : 'bullets' in r.result ? r.result.bullets : [];
  return {
    index,
    name: s.name,
    task: s.task,
    ok: true,
    output: r.result,
    caught: r.findings.map((f) => `${f.kind} “${f.value}”`),
    residual: s.sourceTexts.length ? texts.flatMap((t) => residual(t, s)) : [],
    ms,
  };
}
