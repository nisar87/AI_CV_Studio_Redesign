import { z } from 'zod';
import type { Job } from './schema';

/**
 * Reminders (R9.6, complete-studio-spec §10: "Follow up with Acme in 3 days"; daily digest by
 * email). A reminder belongs to a job and is due at DIGEST_HOUR on its day in the person's time
 * zone. The hourly sender emails each due reminder once, in one digest per person.
 */
export const MAX_REMINDERS = 10;
export const DIGEST_HOUR = 8;

export type Reminder = {
  id: string;
  /** The day, yyyy-mm-dd, in the person's time zone. */
  on: string;
  note: string;
  done: boolean;
  /** When it becomes due (DIGEST_HOUR on `on` in the person's time zone), ISO. */
  dueAt: string;
  /** When it was emailed ('' if not yet). Each reminder is emailed once. */
  emailedAt: string;
  createdAt: string;
};

export const reminderInput = z.object({
  on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a day.'),
  note: z.string().trim().max(200).default(''),
  /** The person's IANA time zone (from the browser). */
  tz: z.string().max(64).default('UTC'),
});

/** A valid IANA time zone, or UTC. */
export function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Minutes the zone is ahead of UTC at that instant. */
function offsetMinutes(at: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant a reminder for `on` (yyyy-mm-dd) is due: DIGEST_HOUR local time in `tz`. */
export function dueAtFor(on: string, tz: string): string {
  const zone = safeZone(tz);
  const [y, m, d] = on.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, DIGEST_HOUR);
  // Two passes handle a daylight-saving change between the guess and the real instant.
  let t = guess - offsetMinutes(new Date(guess), zone) * 60_000;
  t = guess - offsetMinutes(new Date(t), zone) * 60_000;
  return new Date(t).toISOString();
}

/** Today's date (yyyy-mm-dd) in a time zone. */
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeZone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** yyyy-mm-dd plus n days (calendar arithmetic, no time zone). */
export function addDays(on: string, n: number): string {
  const [y, m, d] = on.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Checks a requested day: not in the past, not more than a year ahead. */
export function checkDay(on: string, tz: string, now = new Date()): string | null {
  const today = todayIn(tz, now);
  if (Number.isNaN(Date.parse(`${on}T00:00:00Z`))) return 'Choose a day.';
  if (on < today) return 'Choose today or a later day.';
  if (on > addDays(today, 366)) return 'Choose a day within the next year.';
  return null;
}

/** Still to be emailed: not done and not sent yet. */
export const pending = (r: Reminder) => !r.done && !r.emailedAt;

/** The earliest moment anything of this person's is due to be emailed (null: nothing). */
export function nextDue(jobs: Pick<Job, 'reminders' | 'stage'>[]): string | null {
  let next: string | null = null;
  for (const j of jobs)
    for (const r of j.reminders ?? []) if (pending(r) && (!next || r.dueAt < next)) next = r.dueAt;
  return next;
}

export type DueItem = { job: Pick<Job, 'id' | 'title' | 'company'>; reminder: Reminder };

/** Reminders due now (to email), oldest first. */
export function dueNow(
  jobs: Pick<Job, 'id' | 'title' | 'company' | 'reminders'>[],
  now: Date,
): DueItem[] {
  const iso = now.toISOString();
  return jobs
    .flatMap((j) =>
      (j.reminders ?? [])
        .filter((r) => pending(r) && r.dueAt <= iso)
        .map((r) => ({ job: { id: j.id, title: j.title, company: j.company }, reminder: r })),
    )
    .sort((a, b) => a.reminder.dueAt.localeCompare(b.reminder.dueAt));
}

/** The default note for a job: "Follow up with Acme". */
export const defaultNote = (j: Pick<Job, 'company' | 'title'>) =>
  `Follow up${j.company ? ` with ${j.company}` : ` on ${j.title}`}`;

/** The soonest open reminder across jobs (for Home and the board), done ones excluded. */
export function soonest(
  jobs: Pick<Job, 'id' | 'title' | 'company' | 'reminders' | 'stage'>[],
): { job: Pick<Job, 'id' | 'title' | 'company'>; reminder: Reminder } | null {
  let best: { job: Pick<Job, 'id' | 'title' | 'company'>; reminder: Reminder } | null = null;
  for (const j of jobs)
    for (const r of j.reminders ?? [])
      if (!r.done && (!best || r.on < best.reminder.on))
        best = { job: { id: j.id, title: j.title, company: j.company }, reminder: r };
  return best;
}
