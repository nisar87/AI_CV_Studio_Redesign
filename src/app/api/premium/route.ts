import { NextResponse } from 'next/server';
import { premiumOffer } from '@/modules/billing/premium';
import { currentUser } from '@/modules/identity/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await premiumOffer(await currentUser()), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
