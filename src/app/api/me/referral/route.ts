import { NextResponse } from 'next/server';
import { apiError, requestId } from '@/lib/http';
import { getBusinessConfig } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { makeReferralCode } from '@/modules/referrals/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET → this person's invite link details, or { enabled: false } when invites are off. */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { value: cfg } = await getBusinessConfig();
  const noStore = { headers: { 'Cache-Control': 'no-store' } };
  if (!cfg.referrals.enabled || !cfg.features.sales)
    return NextResponse.json({ enabled: false }, noStore);
  const store = getUserStore();
  const [code, joined] = await Promise.all([
    store.referralCodeOf(user.uid, makeReferralCode),
    store.countReferred(user.uid),
  ]);
  return NextResponse.json(
    {
      enabled: true,
      code,
      joined,
      rewardDays: cfg.referrals.rewardDays,
      welcomeDays: cfg.referrals.welcomeDays,
    },
    noStore,
  );
}
