import { z } from 'zod';
import { stem } from '@/modules/jobs/match';

/**
 * Story bank (R9.3): reusable achievement stories in the STAR shape, written once and tagged by
 * skill. Kept in the account at users/{uid}/stories/{id}; used in mock interviews, by the coach
 * and in letters. The text is the person's own (AI drafts are fact-guarded).
 */
export const STORY_PARTS = ['situation', 'task', 'action', 'result'] as const;
export type StoryPart = (typeof STORY_PARTS)[number];

export const STORY_PART_LABEL: Record<StoryPart, { title: string; hint: string }> = {
  situation: { title: 'Situation', hint: 'Where were you, and what was going on?' },
  task: { title: 'Task', hint: 'What did you need to do, or what was the problem?' },
  action: { title: 'Action', hint: 'What did you do yourself? Use “I”.' },
  result: { title: 'Result', hint: 'What changed because of it? Numbers help, if they are true.' },
};

const part = z.string().trim().max(1200).default('');

export const storyInput = z.object({
  title: z.string().trim().min(1, 'Give the story a short title.').max(120),
  situation: part,
  task: part,
  action: part,
  result: part,
  /** Skill tags, e.g. "Leadership", "Route planning". */
  skills: z
    .array(z.string().trim().min(1).max(40))
    .max(8)
    .default([])
    .transform((s) => dedupe(s)),
  /** Where it came from: a CV point (digest id and job), a mock-interview answer, or typed. */
  source: z
    .object({
      kind: z.enum(['manual', 'cv', 'mock']),
      ref: z.string().max(160).default(''),
    })
    .default({ kind: 'manual', ref: '' }),
});
export type StoryInput = z.input<typeof storyInput>;
export type Story = z.infer<typeof storyInput> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

/** A story only counts as written once it has an action (the part interviewers listen for). */
export const isComplete = (s: Pick<Story, 'action'>) => s.action.trim().length > 0;

function dedupe(tags: string[]) {
  const seen = new Set<string>();
  return tags.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The story as one answer, in STAR order (for the mock interview's "Use this story"). */
export function storyAsAnswer(s: Story): string {
  return STORY_PARTS.map((p) => s[p].trim())
    .filter(Boolean)
    .join(' ');
}

/** Stories as lines for the AI (facts it may use; data, not instructions). */
export function storyLines(stories: Story[], max = 12): string {
  return stories
    .filter(isComplete)
    .slice(0, max)
    .map(
      (s, i) =>
        `S${i + 1}: ${s.title}${s.skills.length ? ` [${s.skills.join(', ')}]` : ''} — ${storyAsAnswer(s)}`,
    )
    .join('\n')
    .slice(0, 8000);
}

const STOP = new Set(
  'a an and are as at be by can did do does for from had has have how i in is it me my of on or our tell that the this to was we were what when where which who why will with would you your about time give example describe'.split(
    ' ',
  ),
);
const words = (t: string) =>
  new Set(
    (t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem),
  );

/**
 * Stories that fit a question or advert, best first: a skill tag that appears in the text counts
 * most, then shared words with the title and story. Only stories with an action are offered.
 */
export function matchStories(stories: Story[], text: string, n = 3): Story[] {
  const q = words(text);
  if (!q.size) return [];
  const scored = stories.filter(isComplete).map((s) => {
    let score = 0;
    for (const tag of s.skills) {
      const t = [...words(tag)];
      if (t.length && t.every((w) => q.has(w))) score += 3;
    }
    for (const w of words(s.title)) if (q.has(w)) score += 2;
    for (const w of words(storyAsAnswer(s))) if (q.has(w)) score += 0.5;
    return { s, score };
  });
  return scored
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score || b.s.updatedAt.localeCompare(a.s.updatedAt))
    .slice(0, n)
    .map((x) => x.s);
}
