'use client';

import { JobsError } from '@/features/jobs/api';
import type { ResumeDocument } from '@/modules/resume/schema';
import type { Story, StoryInput } from '@/modules/stories/schema';

/** Browser helpers for the story bank. Errors carry the server's plain-language message. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const j = (await r.json().catch(() => null)) as
    (T & { error?: undefined }) | { error: { message: string; reason?: string } } | null;
  if (!r.ok || !j || ('error' in j && j.error))
    throw new JobsError(
      (j && 'error' in j && j.error?.message) || 'That didn’t work. Please try again.',
      r.status,
      (j && 'error' in j && j.error?.reason) || undefined,
    );
  return j as T;
}

export type StoryDraft = Required<
  Pick<StoryInput, 'title' | 'situation' | 'task' | 'action' | 'result' | 'skills' | 'source'>
>;

export const storiesApi = {
  list: () => call<{ stories: Story[]; max: number; enabled: boolean }>('/api/stories'),
  create: (input: StoryInput) =>
    call<{ story: Story }>('/api/stories', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.story),
  update: (id: string, patch: Partial<StoryInput>) =>
    call<{ story: Story }>(`/api/stories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }).then((r) => r.story),
  remove: (id: string) => call<{ ok: true }>(`/api/stories/${id}`, { method: 'DELETE' }),
  draft: (document: ResumeDocument, point: string, notes: string) =>
    call<{ draft: StoryDraft }>('/api/stories/draft', {
      method: 'POST',
      body: JSON.stringify({ document, point, notes }),
    }).then((r) => r.draft),
};
