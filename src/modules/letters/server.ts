import 'server-only';
import { apiError, requestId } from '@/lib/http';
import { currentUser, type SessionUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';
import type { SavedLetter } from './schema';

export type LetterCtx = { params: Promise<{ id: string }> };

/** Signed in and the letter is theirs. */
export async function loadLetter(
  ctx: LetterCtx,
): Promise<{ error: Response } | { rid: string; user: SessionUser; letter: SavedLetter }> {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return { error: apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid) };
  const { id } = await ctx.params;
  const letter = /^[\w-]{1,64}$/.test(id) ? await getUserStore().getLetter(user.uid, id) : null;
  if (!letter) return { error: apiError('NOT_FOUND', 'Letter not found.', rid) };
  return { rid, user, letter };
}
