import { describe, expect, it } from 'vitest';
import { append, checkActions, MAX_MESSAGES } from './thread';

describe('coach thread', () => {
  it('keeps only actions the person can take', () => {
    const a = checkActions(
      [
        { tool: 'tailor_cv', arg: 'job1' },
        { tool: 'tailor_cv', arg: 'someone-elses-job' },
        { tool: 'write_letter', arg: 'resignation' },
        { tool: 'write_letter', arg: 'ransom' },
        { tool: 'ats_check', arg: 'anything' },
        { tool: 'tailor_cv', arg: 'job1' },
      ],
      new Set(['job1']),
    );
    expect(a).toEqual([
      { tool: 'tailor_cv', arg: 'job1' },
      { tool: 'write_letter', arg: 'resignation' },
      { tool: 'ats_check', arg: '' },
    ]);
  });

  it('a learning plan keeps their own job, otherwise becomes a general plan', () => {
    const a = checkActions(
      [
        { tool: 'skill_gap', arg: 'job1' },
        { tool: 'skill_gap', arg: 'someone-elses-job' },
        { tool: 'skill_gap', arg: '' },
      ],
      new Set(['job1']),
    );
    expect(a).toEqual([
      { tool: 'skill_gap', arg: 'job1' },
      { tool: 'skill_gap', arg: '' },
    ]);
  });

  it('appends exchanges and keeps the last messages', () => {
    let t = null as ReturnType<typeof append> | null;
    for (let i = 0; i < 30; i++) t = append(t, `q${i}`, { reply: `a${i}`, actions: [] });
    expect(t!.messages).toHaveLength(MAX_MESSAGES);
    expect(t!.messages.at(-1)).toMatchObject({ role: 'coach', text: 'a29' });
    expect(t!.messages[0]).toMatchObject({ role: 'user', text: 'q10' });
  });
});
