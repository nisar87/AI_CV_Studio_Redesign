import { NextResponse } from 'next/server';
import { publicConfig } from '@/modules/identity/public-config';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(publicConfig(), { headers: { 'Cache-Control': 'no-store' } });
}
