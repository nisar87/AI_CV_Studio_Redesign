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
import { createGeminiProvider } from '../src/modules/ai/providers/gemini';
import { createMockProvider } from '../src/modules/ai/providers/mock';
import { evalSamples, residual } from '../src/modules/ai/eval';
import { runTask } from '../src/modules/ai/run';

const mock = process.argv.includes('--mock');
const key = process.env.GEMINI_API_KEY;
if (!mock && !key) {
  console.error('Set GEMINI_API_KEY (or pass --mock for a dry run).');
  process.exit(2);
}
const provider = mock ? createMockProvider() : createGeminiProvider({ apiKey: key! });
const models = aiModels();

const samples = evalSamples();

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
