import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { getBusinessConfig } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { MAX_LETTERS, savedLetterInput, type SavedLetter } from '@/modules/letters/schema';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** GET → { letters, max } (the letter library of the signed-in person). */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to keep letters.', rid);
  const letters = await getUserStore().listLetters(user.uid);
  return NextResponse.json({ letters, max: MAX_LETTERS }, noStore);
}

/** POST SavedLetterInput → the new letter. Writing letters yourself is free; AI drafts are not. */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to keep letters.', rid);
  const body = await readJson(req, 64 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const parsed = savedLetterInput.safeParse(body.value);
  if (!parsed.success)
    return apiError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid letter.', rid);
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.letters || cfg.content.hiddenLetterTypes.includes(parsed.data.type))
    return apiError('DISABLED', 'This letter type isn’t available right now.', rid, {
      reason: 'disabled',
    });
  const store = getUserStore();
  if ((await store.listLetters(user.uid)).length >= MAX_LETTERS)
    return apiError(
      'LIMIT_REACHED',
      `You can keep up to ${MAX_LETTERS} letters. Delete one you no longer need.`,
      rid,
      { reason: 'limit', limit: MAX_LETTERS },
    );
  const now = new Date().toISOString();
  const letter: SavedLetter = {
    ...parsed.data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await store.putLetter(user.uid, letter);
  return NextResponse.json({ letter }, noStore);
}
