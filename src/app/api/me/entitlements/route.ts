import { NextResponse } from 'next/server';
import { entitlementsFor } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Plan, limits, this month's usage and the public catalogue — for display only. */
export async function GET() {
  return NextResponse.json(await entitlementsFor(await currentUser()), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
