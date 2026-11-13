import { aiModels, getAiProvider } from '@/modules/ai/config';
import { allDesignSamples, runDesignSample } from '@/modules/ai/design-eval';
import { apiError } from '@/lib/http';
import { json, withAdmin } from '@/modules/admin/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** GET → the AI Designer acceptance set. POST { from, count } → runs up to 4 samples live. */
export function GET() {
  return withAdmin(async () =>
    json({
      samples: allDesignSamples().map((s, i) => ({ index: i, name: s.name, kind: s.kind })),
    }),
  );
}

export function POST(req: Request) {
  return withAdmin(async (_admin, rid) => {
    const { provider, mode } = getAiProvider();
    if (!provider) return apiError('AI_UNAVAILABLE', 'AI is switched off on the server.', rid);
    const b = (await req.json().catch(() => ({}))) as { from?: number; count?: number };
    const total = allDesignSamples().length;
    const from = Math.max(0, Math.min(total, Math.floor(Number(b.from) || 0)));
    const count = Math.max(1, Math.min(4, Math.floor(Number(b.count) || 4)));
    const results = await Promise.all(
      Array.from({ length: Math.min(count, total - from) }, (_, k) =>
        runDesignSample(from + k, { provider, models: aiModels() }),
      ),
    );
    return json({ mode, models: aiModels(), total, results });
  });
}
