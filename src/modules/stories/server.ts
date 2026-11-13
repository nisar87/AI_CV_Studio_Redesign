import 'server-only';
import { apiError, requestId } from '@/lib/http';
import { getBusinessConfig, planFor } from '@/modules/billing/server';
import { currentUser, type SessionUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';
import type { Story } from './schema';

export type StoryCtx = { params: Promise<{ id: string }> };

/** How many stories this person may keep (-1 = no limit), and whether the bank is on. */
export async function storyAllowance(user: SessionUser) {
  const [{ plan }, { value: cfg }] = await Promise.all([planFor(user), getBusinessConfig()]);
  return { plan, max: cfg.plans[plan].maxStories, enabled: cfg.features.stories };
}

/** Signed in, the bank is on, and the story is theirs. */
export async function loadStory(
  ctx: StoryCtx,
): Promise<{ error: Response } | { rid: string; user: SessionUser; story: Story }> {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return { error: apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid) };
  const { id } = await ctx.params;
  const story = /^[\w-]{1,64}$/.test(id) ? await getUserStore().getStory(user.uid, id) : null;
  if (!story) return { error: apiError('NOT_FOUND', 'Story not found.', rid) };
  return { rid, user, story };
}

/** Stories that can be shown to the AI as the person's own facts (finished ones, newest first). */
export async function storiesForAi(uid: string): Promise<Story[]> {
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.stories) return [];
  return (await getUserStore().listStories(uid)).filter((s) => s.action.trim());
}
