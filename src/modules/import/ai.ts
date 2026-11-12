import 'server-only';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import type { ResumeDocument } from '@/modules/resume/schema';
import type { ImportReport } from './parse';
import { checkFidelity, structureToDoc, uncoveredLines } from './structure';

export type AiImport =
  | { ok: true; doc: ResumeDocument; report: ImportReport; model: string }
  | { ok: false; reason: string };

/**
 * Structure the CV with the AI (copy-only), then verify: nothing invented (every word is in the
 * file) and nothing lost (unused lines go to "Other"). Any failure → the caller uses the rules.
 */
export async function importWithAi(
  lines: string[],
  key: string,
  opts: { locale?: string } = {},
): Promise<AiImport> {
  const { mode, provider } = getAiProvider();
  if (mode === 'off' || !provider) return { ok: false, reason: 'off' };
  const limit = sharedAiLimiter()(`import:${key}`);
  if (!limit.ok) return { ok: false, reason: `limit_${limit.reason}` };
  // Keep the request bounded: a CV is rarely over 400 lines.
  const input = lines.slice(0, 400).map((l) => l.slice(0, 600));
  const r = await runTask('import.structure', { lines: input }, 0, {
    provider,
    models: aiModels(),
    timeoutMs: 60_000,
  });
  if (!r.ok) return { ok: false, reason: `${r.code}:${r.reason}` };
  const fidelity = checkFidelity(r.result, lines);
  if (!fidelity.ok) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        area: 'import',
        event: 'ai_invented',
        count: fidelity.invented.length,
      }),
    );
    return { ok: false, reason: 'fidelity' };
  }
  const extra = uncoveredLines(r.result, lines);
  const { doc, report } = structureToDoc(r.result, extra, opts);
  return { ok: true, doc, report, model: r.model };
}
