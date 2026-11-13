import type { CoachTool, TaskOutput } from '@/modules/ai/schemas';
import { isLetterType } from '@/modules/letters/types';

/**
 * Career coach (complete-studio-spec §10.3): one conversation per account, kept short. The coach
 * may offer studio actions; they are buttons the person chooses, and each one goes through the same
 * route (and the same plan checks) as the rest of the studio.
 */
export const MAX_MESSAGES = 40;
export const HISTORY_FOR_MODEL = 12;

export type CoachAction = { tool: CoachTool; arg: string };
export type CoachMessage = {
  role: 'user' | 'coach';
  text: string;
  at: string;
  actions?: CoachAction[];
};
export type CoachThread = { messages: CoachMessage[]; updatedAt: string };

const JOB_TOOLS = new Set<CoachTool>([
  'tailor_cv',
  'application_kit',
  'cover_letter',
  'job_match',
  'mock_interview',
]);

/** Only actions the person can really take: their own jobs, real letter types, no duplicates. */
export function checkActions(
  actions: TaskOutput<'coach.chat'>['actions'],
  jobIds: Set<string>,
): CoachAction[] {
  const seen = new Set<string>();
  return (
    actions
      .map((a) => ({ tool: a.tool, arg: a.arg.trim() }))
      .filter((a) => {
        if (JOB_TOOLS.has(a.tool)) return jobIds.has(a.arg);
        if (a.tool === 'write_letter') return isLetterType(a.arg);
        return true;
      })
      // A learning plan may be for one of their jobs, or for a role in general ('').
      .map((a) =>
        JOB_TOOLS.has(a.tool) || a.tool === 'write_letter'
          ? a
          : a.tool === 'skill_gap' && jobIds.has(a.arg)
            ? a
            : { ...a, arg: '' },
      )
      .filter((a) => !seen.has(`${a.tool}:${a.arg}`) && seen.add(`${a.tool}:${a.arg}`))
  );
}

/** The thread with a new exchange added, keeping the last MAX_MESSAGES. */
export function append(
  t: CoachThread | null,
  user: string,
  coach: { reply: string; actions: CoachAction[] },
  now = new Date(),
): CoachThread {
  const at = now.toISOString();
  const messages = [
    ...(t?.messages ?? []),
    { role: 'user' as const, text: user, at },
    { role: 'coach' as const, text: coach.reply, at, actions: coach.actions },
  ].slice(-MAX_MESSAGES);
  return { messages, updatedAt: at };
}
