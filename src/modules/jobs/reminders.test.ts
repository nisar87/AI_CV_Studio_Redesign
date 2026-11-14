import { describe, expect, it } from 'vitest';
import { reminderEmail } from '@/modules/notify/server';
import {
  addDays,
  checkDay,
  defaultNote,
  dueAtFor,
  dueNow,
  nextDue,
  safeZone,
  soonest,
  todayIn,
  type Reminder,
} from './reminders';

const r = (over: Partial<Reminder>): Reminder => ({
  id: over.id ?? 'r',
  on: '2026-11-20',
  note: 'Follow up',
  done: false,
  dueAt: '2026-11-20T03:00:00.000Z',
  emailedAt: '',
  createdAt: '2026-11-14T00:00:00.000Z',
  ...over,
});

describe('reminders: when they are due', () => {
  it('is 8:00 on the day in the person’s own time zone, across daylight saving', () => {
    expect(dueAtFor('2026-11-20', 'Asia/Karachi')).toBe('2026-11-20T03:00:00.000Z');
    expect(dueAtFor('2026-11-20', 'Europe/London')).toBe('2026-11-20T08:00:00.000Z');
    expect(dueAtFor('2026-07-01', 'Europe/London')).toBe('2026-07-01T07:00:00.000Z');
    expect(dueAtFor('2026-11-20', 'America/New_York')).toBe('2026-11-20T13:00:00.000Z');
    expect(dueAtFor('2026-11-20', 'Asia/Kolkata')).toBe('2026-11-20T02:30:00.000Z');
    // The day after the clocks change (Europe/London, 25 Oct 2026).
    expect(dueAtFor('2026-10-26', 'Europe/London')).toBe('2026-10-26T08:00:00.000Z');
    expect(dueAtFor('2026-11-20', 'Not/AZone')).toBe('2026-11-20T08:00:00.000Z');
    expect(safeZone('Not/AZone')).toBe('UTC');
  });

  it('knows today in a zone, and accepts only today to a year ahead', () => {
    const now = new Date('2026-11-14T21:00:00Z');
    expect(todayIn('Asia/Karachi', now)).toBe('2026-11-15');
    expect(todayIn('Europe/London', now)).toBe('2026-11-14');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(checkDay('2026-11-15', 'Asia/Karachi', now)).toBeNull();
    expect(checkDay('2026-11-14', 'Asia/Karachi', now)).toMatch(/today or a later day/);
    expect(checkDay('2028-01-01', 'Asia/Karachi', now)).toMatch(/within the next year/);
  });
});

describe('reminders: what to email', () => {
  const jobs = [
    {
      id: 'a',
      title: 'Van Driver',
      company: 'Swift',
      stage: 'applied' as const,
      reminders: [
        r({ id: '1', on: '2026-11-13', dueAt: '2026-11-13T03:00:00.000Z' }),
        r({ id: '2', on: '2026-11-14', dueAt: '2026-11-14T03:00:00.000Z', done: true }),
        r({ id: '3', on: '2026-11-14', dueAt: '2026-11-14T03:00:00.000Z', emailedAt: 'x' }),
        r({ id: '4', on: '2026-11-21', dueAt: '2026-11-21T03:00:00.000Z' }),
      ],
    },
    {
      id: 'b',
      title: 'Nurse',
      company: '',
      stage: 'saved' as const,
      reminders: [r({ id: '5', on: '2026-11-14', dueAt: '2026-11-14T03:00:00.000Z' })],
    },
  ];
  const now = new Date('2026-11-14T04:00:00Z');

  it('emails each due reminder once: not done, not already sent, oldest first', () => {
    expect(dueNow(jobs, now).map((d) => d.reminder.id)).toEqual(['1', '5']);
    expect(nextDue(jobs)).toBe('2026-11-13T03:00:00.000Z');
    const afterSending = jobs.map((j) => ({
      ...j,
      reminders: j.reminders.map((x) =>
        ['1', '5'].includes(x.id) ? { ...x, emailedAt: 'now' } : x,
      ),
    }));
    expect(nextDue(afterSending)).toBe('2026-11-21T03:00:00.000Z');
    expect(soonest(jobs)?.reminder.id).toBe('1');
    expect(defaultNote({ company: 'Swift', title: 'Van Driver' })).toBe('Follow up with Swift');
    expect(defaultNote({ company: '', title: 'Nurse' })).toBe('Follow up on Nurse');
  });

  it('builds one digest with a link per job and a one-click way to stop', () => {
    const m = reminderEmail('a@example.com', dueNow(jobs, now), {
      today: '2026-11-14',
      unsubscribeUrl: 'https://aicvstudio.app/api/reminders/stop?u=U&t=T',
    });
    expect(m.subject).toBe('2 reminders for today');
    expect(m.text).toContain(
      '- Follow up — Van Driver at Swift (since Fri 13 Nov)\n  https://aicvstudio.app/jobs/a',
    );
    expect(m.text).toContain('- Follow up — Nurse\n  https://aicvstudio.app/jobs/b');
    expect(m.text).toContain(
      'Stop reminder emails: https://aicvstudio.app/api/reminders/stop?u=U&t=T',
    );
    expect(m.html).toContain('href="https://aicvstudio.app/jobs/a"');
    expect(m.headers).toEqual({
      'List-Unsubscribe': '<https://aicvstudio.app/api/reminders/stop?u=U&t=T>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    // Person text is escaped in the HTML.
    const evil = reminderEmail(
      'a@example.com',
      [
        {
          job: { id: 'x', title: '<b>x</b>', company: '' },
          reminder: { note: '<script>', on: '2026-11-14' },
        },
      ],
      { today: '2026-11-14', unsubscribeUrl: 'u' },
    );
    expect(evil.html).not.toMatch(/<script>|<b>x/);
    expect(evil.subject).toBe('Reminder: <script>');
  });
});
