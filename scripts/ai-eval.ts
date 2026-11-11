/**
 * Live AI evaluation (roadmap Phase 4, acceptance 3 and 4).
 *
 *   GEMINI_API_KEY=… npm run ai:eval            # real Gemini
 *   npm run ai:eval -- --mock                     # dry run with the mock provider
 *
 * Runs every writing task over the profession fixtures (≥ 30 samples) plus the two example
 * requests from the brief, and writes a review log to artifacts/ai-eval/. For each sample it
 * records what the truth guard caught (facts the model added) and runs an independent check
 * that the final text contains no unmarked number, year or credential that is absent from
 * the input. Exit code 1 if that independent check finds anything.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aiModels } from '../src/modules/ai/config';
import { buildSource, derivedYears, guardText } from '../src/modules/ai/guard';
import { createGeminiProvider } from '../src/modules/ai/providers/gemini';
import { createMockProvider } from '../src/modules/ai/providers/mock';
import { runTask } from '../src/modules/ai/run';
import type { TaskId } from '../src/modules/ai/schemas';
import * as F from '../src/modules/resume/fixtures';
import type { ResumeDocument } from '../src/modules/resume/schema';

const mock = process.argv.includes('--mock');
const key = process.env.GEMINI_API_KEY;
if (!mock && !key) {
  console.error('Set GEMINI_API_KEY (or pass --mock for a dry run).');
  process.exit(2);
}
const provider = mock ? createMockProvider() : createGeminiProvider({ apiKey: key! });
const models = aiModels();

type Sample = {
  name: string;
  task: TaskId;
  input: Record<string, unknown>;
  sourceTexts: string[];
  years?: number[];
};
const samples: Sample[] = [];

const docs: ResumeDocument[] = [F.driver, F.teacher, F.nurse, F.graduate, F.engineer, F.executive];
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

/** Independent check: unmarked numbers or credentials in the final text that are not in the input. */
function residual(text: string, s: Sample): string[] {
  const unmarked = text.replace(/\{\{\?[^{}]*\}\}/g, ' ');
  const r = guardText(unmarked, buildSource(s.sourceTexts, s.years ?? []));
  return r.findings.filter((f) => f.kind !== 'name').map((f) => `${f.kind}: ${f.value}`);
}

const outDir = join('artifacts', 'ai-eval');
mkdirSync(outDir, { recursive: true });
const lines: string[] = [
  `# AI evaluation — ${new Date().toISOString()}`,
  '',
  `Provider: ${mock ? 'mock (dry run)' : `gemini (${models.fast} / ${models.smart})`} · Samples: ${samples.length}`,
  '',
];
let caught = 0;
let residualCount = 0;
let failures = 0;
let i = 0;
for (const s of samples) {
  i++;
  process.stdout.write(`[${i}/${samples.length}] ${s.name} … `);
  const r = await runTask(s.task, s.input, 0, { provider, models });
  lines.push(
    `## ${i}. ${s.name}`,
    '',
    '```json',
    JSON.stringify(s.input, null, 1).slice(0, 1500),
    '```',
    '',
  );
  if (!r.ok) {
    failures++;
    console.log(`FAILED (${r.code}: ${r.reason})`);
    lines.push(`**Failed:** ${r.code} (${r.reason})`, '');
    continue;
  }
  caught += r.findings.length;
  const texts =
    'text' in r.result ? [r.result.text] : 'bullets' in r.result ? r.result.bullets : [];
  const leftover = s.sourceTexts.length ? texts.flatMap((t) => residual(t, s)) : [];
  residualCount += leftover.length;
  console.log(
    `ok · guard caught ${r.findings.length}${leftover.length ? ` · RESIDUAL ${leftover.length}` : ''}`,
  );
  lines.push('Result:', '', '```json', JSON.stringify(r.result, null, 1), '```', '');
  if (r.findings.length)
    lines.push(`Guard replaced: ${r.findings.map((f) => `${f.kind} “${f.value}”`).join(', ')}`, '');
  if (leftover.length) lines.push(`**Unmarked new facts (must be 0):** ${leftover.join(', ')}`, '');
  lines.push('Reviewer: ☐ faithful ☐ invented fact ☐ poor wording', '');
}
lines.splice(
  4,
  0,
  `Failures: ${failures} · Facts added by the model and caught by the guard: ${caught} · Unmarked new facts after the guard: ${residualCount}`,
  '',
);
const file = join(outDir, `eval-${mock ? 'mock' : 'gemini'}-${Date.now()}.md`);
writeFileSync(file, lines.join('\n'));
console.log(
  `\nSamples ${samples.length} · failures ${failures} · caught by guard ${caught} · unmarked new facts ${residualCount}\nLog: ${file}`,
);
process.exit(residualCount > 0 ? 1 : 0);
