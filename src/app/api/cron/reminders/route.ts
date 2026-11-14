import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { runReminders } from '@/modules/jobs/reminders-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const testHooks = () => process.env.E2E_TEST_HOOKS === '1' && process.env.DATA_STORE === 'memory';

/**
 * The hourly reminder sender (R9.6), called by the scheduled GitHub workflow (.github/workflows/
 * reminders.yml). Safe without a secret: it only emails reminders that are due, each once, and
 * runs at most once per 10 minutes (shared lease). If CRON_KEY is set, the x-cron-key header must
 * match. The e2e suite may set the clock (`now`) and skip the lease (`force`).
 */
async function run(req: Request) {
  const key = process.env.CRON_KEY;
  if (key && req.headers.get('x-cron-key') !== key)
    return apiError('UNAUTHORIZED', 'Not allowed.', requestId());
  const url = new URL(req.url);
  const test = testHooks();
  const nowParam = test ? url.searchParams.get('now') : null;
  const now = nowParam && !Number.isNaN(Date.parse(nowParam)) ? new Date(nowParam) : new Date();
  const result = await runReminders(now, { force: test && url.searchParams.get('force') === '1' });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = run;
export const POST = run;
