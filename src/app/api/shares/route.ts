import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { newShareToken, publicShare } from '@/modules/share/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** GET ?docId= → this person's links (optionally for one CV). */
export async function GET(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const docId = new URL(req.url).searchParams.get('docId');
  const shares = (await getUserStore().listShares(user.uid))
    .filter((s) => !docId || s.docId === docId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicShare);
  return NextResponse.json({ shares }, noStore);
}

/** POST { docId } → a new read-only link for a CV saved in the account (one per CV). */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Sign in to share a link to your CV.', rid);
  const body = await readJson(req, 4 * 1024);
  const docId = body.ok ? String((body.value as { docId?: unknown })?.docId ?? '') : '';
  if (!/^[\w-]{1,64}$/.test(docId)) return apiError('INVALID_INPUT', 'Choose a CV.', rid);
  const store = getUserStore();
  const stored = await store.getDoc(user.uid, docId);
  if (!stored || stored.deleted)
    return apiError(
      'NOT_FOUND',
      'This CV is still saving to your account. Try again in a moment.',
      rid,
    );
  const existing = (await store.listShares(user.uid)).find((s) => s.docId === docId);
  if (existing) {
    if (!existing.enabled) await store.updateShare(existing.token, { enabled: true });
    return NextResponse.json({ share: publicShare({ ...existing, enabled: true }) }, noStore);
  }
  const share = {
    token: newShareToken(),
    uid: user.uid,
    docId,
    enabled: true,
    createdAt: new Date().toISOString(),
    views: 0,
    lastViewedAt: null,
  };
  await store.createShare(share);
  return NextResponse.json({ share: publicShare(share) }, noStore);
}
