import type { TaskOutput } from '@/modules/ai/schemas';
import type { InterviewKind } from './interview';

/**
 * Mock interview (complete-studio-spec §10.3): one question at a time; after each answer, feedback
 * on structure (STAR) and relevance that quotes the person's own answer. Stored on the job.
 */
export const MOCK_QUESTIONS = 5;

export type MockFeedback = TaskOutput<'interview.turn'>['feedback'];
export type MockTurn = {
  question: string;
  kind: InterviewKind;
  answer: string;
  feedback: MockFeedback;
};
export type MockSession = {
  startedAt: string;
  turns: MockTurn[];
  /** The question waiting for an answer, or null when the interview is over. */
  current: { question: string; kind: InterviewKind } | null;
  summary: string;
};

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Feedback as shown: the quote must really be in the answer (otherwise it is dropped). */
export function checkFeedback(f: MockFeedback, answer: string): MockFeedback {
  const q = f.quote.trim().replace(/^["“'‘]|["”'’]$/g, '');
  return { ...f, quote: q && squash(answer).includes(squash(q)) ? q : '' };
}

/** Next state of a session after one AI turn. */
export function advance(
  s: MockSession | undefined,
  out: TaskOutput<'interview.turn'>,
  answer: string,
  now = new Date(),
): MockSession {
  if (!s || !s.current)
    return {
      startedAt: now.toISOString(),
      turns: [],
      current: out.next.question.trim() ? out.next : null,
      summary: '',
    };
  const turns = [
    ...s.turns,
    { ...s.current, answer, feedback: checkFeedback(out.feedback, answer) },
  ];
  const done = turns.length >= MOCK_QUESTIONS || !out.next.question.trim();
  return {
    ...s,
    turns,
    current: done ? null : out.next,
    summary: done ? out.summary : '',
  };
}
