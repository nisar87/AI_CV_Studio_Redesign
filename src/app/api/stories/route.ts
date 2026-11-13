import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { storyInput, type Story } from '@/modules/stories/schema';
import { storyAllowance } from '@/modules/stories/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** GET → { stories, max, enabled } (the story bank of the signed-in person). */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to keep stories.', rid);
  const [stories, allow] = await Promise.all([
    getUserStore().listStories(user.uid),
    storyAllowance(user),
  ]);
  return NextResponse.json({ stories, max: allow.max, enabled: allow.enabled }, noStore);
}

/** POST StoryInput → the new story. Writing stories yourself is free, up to the plan's number. */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to keep stories.', rid);
  const body = await readJson(req, 32 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const parsed = storyInput.safeParse(body.value);
  if (!parsed.success)
    return apiError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid story.', rid);
  const allow = await storyAllowance(user);
  if (!allow.enabled)
    return apiError('DISABLED', 'The story bank is switched off right now.', rid, {
      reason: 'disabled',
    });
  const store = getUserStore();
  const count = (await store.listStories(user.uid)).length;
  if (allow.max !== -1 && count >= allow.max)
    return apiError(
      'LIMIT_REACHED',
      allow.max === 0
        ? 'The story bank isn’t part of your plan.'
        : `Your plan keeps up to ${allow.max} stories. Delete one, or get Premium to keep more.`,
      rid,
      { reason: 'limit', limit: allow.max },
    );
  const now = new Date().toISOString();
  const story: Story = { ...parsed.data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await store.putStory(user.uid, story);
  return NextResponse.json({ story }, noStore);
}
