import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { denialCode, reserve } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { makeoverRecord, markClaimed, validMakeoverId } from '@/modules/makeover/server';
import { track } from '@/modules/metrics/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST { makeoverId } → { ok } when the makeover may be saved to this account. A preview counts
 * one import.cv use now; a "full" makeover was counted when it ran. Each makeover is saved once.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to save your CV.', rid);
  const body = await readJson(req, 2048);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const id = (body.value as { makeoverId?: unknown }).makeoverId;
  if (!validMakeoverId(id)) return apiError('INVALID_INPUT', 'Invalid request.', rid);
  const rec = await makeoverRecord(id);
  if (!rec) return apiError('NOT_FOUND', 'This makeover has expired. Please upload again.', rid);
  if (rec.claimed) return NextResponse.json({ ok: true, already: true });

  let release = async () => {};
  if (!rec.paid) {
    const gate = await reserve(user, 'import.cv');
    if (!gate.decision.ok)
      return apiError(denialCode(gate.decision), gate.decision.message, rid, {
        reason: gate.decision.reason,
      });
    release = gate.release;
  }
  if (!(await markClaimed(id))) {
    // Saved by another tab at the same moment: don't count it twice.
    await release();
    return NextResponse.json({ ok: true, already: true });
  }
  await track('makeover_saved');
  return NextResponse.json({ ok: true });
}
