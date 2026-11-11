import { NextResponse } from 'next/server';
import { chromiumAvailable } from '@/modules/export/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const chromium = (await chromiumAvailable()) ? 'ok' : 'unavailable';
  const ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'mock';
  return NextResponse.json(
    {
      status: 'ok',
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'dev',
      checks: { chromium, ai },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
