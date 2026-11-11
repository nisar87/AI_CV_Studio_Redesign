import { NextResponse } from 'next/server';
import { aiMode } from '@/modules/ai/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/ai/status — whether AI help is offered, and whether answers are real or demo. */
export async function GET() {
  const mode = aiMode();
  return NextResponse.json(
    { enabled: mode !== 'off', provider: mode },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
