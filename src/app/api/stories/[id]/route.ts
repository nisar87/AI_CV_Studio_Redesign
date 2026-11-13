import { NextResponse } from 'next/server';
import { apiError, readJson } from '@/lib/http';
import { storyInput, type Story } from '@/modules/stories/schema';
import { loadStory, type StoryCtx } from '@/modules/stories/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(_req: Request, ctx: StoryCtx) {
  const r = await loadStory(ctx);
  if ('error' in r) return r.error;
  return NextResponse.json({ story: r.story }, noStore);
}

/** PUT partial StoryInput → the updated story (where it came from stays). */
export async function PUT(req: Request, ctx: StoryCtx) {
  const r = await loadStory(ctx);
  if ('error' in r) return r.error;
  const body = await readJson(req, 32 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', r.rid);
  const parsed = storyInput.safeParse({
    ...r.story,
    ...(body.value as object),
    source: r.story.source,
  });
  if (!parsed.success)
    return apiError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid story.', r.rid);
  const story: Story = {
    ...parsed.data,
    id: r.story.id,
    createdAt: r.story.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await getUserStore().putStory(r.user.uid, story);
  return NextResponse.json({ story }, noStore);
}

export async function DELETE(_req: Request, ctx: StoryCtx) {
  const r = await loadStory(ctx);
  if ('error' in r) return r.error;
  await getUserStore().deleteStory(r.user.uid, r.story.id);
  return NextResponse.json({ ok: true }, noStore);
}
