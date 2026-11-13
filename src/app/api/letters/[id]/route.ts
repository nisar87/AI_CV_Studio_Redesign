import { NextResponse } from 'next/server';
import { apiError, readJson } from '@/lib/http';
import { savedLetterInput, type SavedLetter } from '@/modules/letters/schema';
import { loadLetter, type LetterCtx } from '@/modules/letters/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(_req: Request, ctx: LetterCtx) {
  const r = await loadLetter(ctx);
  if ('error' in r) return r.error;
  return NextResponse.json({ letter: r.letter }, noStore);
}

/** PUT partial SavedLetterInput → the updated letter (the type can't change). */
export async function PUT(req: Request, ctx: LetterCtx) {
  const r = await loadLetter(ctx);
  if ('error' in r) return r.error;
  const body = await readJson(req, 64 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', r.rid);
  const parsed = savedLetterInput.safeParse({
    ...r.letter,
    ...(body.value as object),
    type: r.letter.type,
  });
  if (!parsed.success)
    return apiError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid letter.', r.rid);
  const letter: SavedLetter = {
    ...parsed.data,
    id: r.letter.id,
    createdAt: r.letter.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await getUserStore().putLetter(r.user.uid, letter);
  return NextResponse.json({ letter }, noStore);
}

export async function DELETE(_req: Request, ctx: LetterCtx) {
  const r = await loadLetter(ctx);
  if ('error' in r) return r.error;
  await getUserStore().deleteLetter(r.user.uid, r.letter.id);
  return NextResponse.json({ ok: true }, noStore);
}
