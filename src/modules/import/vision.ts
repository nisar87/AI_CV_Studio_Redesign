import 'server-only';
import { aiModels, getAiProvider } from '@/modules/ai/config';
import { sharedAiLimiter } from '@/modules/ai/limits';
import { runTask } from '@/modules/ai/run';
import { aiBudgetSpent } from '@/modules/metrics/server';

export type Transcribed =
  { ok: true; lines: string[]; photo: boolean } | { ok: false; reason: string };

/**
 * Vision fallback (spec §6.2 step 3): a scanned PDF or a photo of a CV is sent to the multimodal
 * model, which types out its text in reading order. One call; structuring happens afterwards.
 */
export async function transcribeFile(
  bytes: Uint8Array,
  mime: string,
  key: string,
): Promise<Transcribed> {
  const { mode, provider } = getAiProvider();
  if (mode === 'off' || !provider) return { ok: false, reason: 'off' };
  const limit = sharedAiLimiter()(`vision:${key}`);
  if (!limit.ok) return { ok: false, reason: `limit_${limit.reason}` };
  if (await aiBudgetSpent()) return { ok: false, reason: 'limit_budget' };
  const r = await runTask(
    'import.transcribe',
    { kind: mime === 'application/pdf' ? 'pdf' : 'image' },
    0,
    {
      provider,
      models: aiModels(),
      timeoutMs: 35_000,
      files: [{ mimeType: mime, data: Buffer.from(bytes).toString('base64') }],
    },
  );
  if (!r.ok) return { ok: false, reason: `${r.code}:${r.reason}` };
  const lines = r.result.lines.map((l) => l.slice(0, 600)).slice(0, 400);
  if (lines.join('').length < 20) return { ok: false, reason: 'empty' };
  return { ok: true, lines, photo: r.result.photo };
}
