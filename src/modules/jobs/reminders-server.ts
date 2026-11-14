import 'server-only';
import { getBusinessConfig } from '@/modules/billing/server';
import { track } from '@/modules/metrics/server';
import { reminderEmail, sendMail, SITE } from '@/modules/notify/server';
import { getUserStore } from '@/modules/store';
import type { ReminderQueue } from '@/modules/store/types';
import { dueNow, nextDue, safeZone, todayIn } from './reminders';

const token = () => {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Buffer.from(b).toString('base64url');
};

/** The "stop reminder emails" link for a person. */
export const stopUrl = (q: Pick<ReminderQueue, 'uid' | 'token'>) =>
  `${SITE}/api/reminders/stop?u=${encodeURIComponent(q.uid)}&t=${encodeURIComponent(q.token)}`;

/**
 * Keeps the person's queue entry in step with their jobs after any reminder change: the earliest
 * reminder still to email, their address and time zone. Created on first use.
 */
export async function syncQueue(
  user: { uid: string; email: string | null },
  opts: { tz?: string; off?: boolean } = {},
): Promise<ReminderQueue> {
  const store = getUserStore();
  const [jobs, cur] = await Promise.all([
    store.listJobs(user.uid),
    store.getReminderQueue(user.uid),
  ]);
  const q: ReminderQueue = {
    uid: user.uid,
    email: user.email ?? cur?.email ?? null,
    tz: safeZone(opts.tz ?? cur?.tz ?? 'UTC'),
    next: nextDue(jobs),
    off: opts.off ?? cur?.off ?? false,
    token: cur?.token ?? token(),
    updatedAt: new Date().toISOString(),
  };
  await store.putReminderQueue(q);
  return q;
}

export type RunResult = {
  ran: boolean;
  people: number;
  emails: number;
  reminders: number;
  failed: number;
  skipped: number;
};

const LEASE_MS = 10 * 60_000;
const RETRY_MS = 60 * 60_000;
const BATCH = 200;

/**
 * The hourly sender (R9.6). Safe to call any time and from anywhere: it holds a 10-minute lease,
 * emails only reminders that are due, each one once, and one digest per person. A failed email is
 * retried an hour later. People who turned reminder emails off get none (their reminders still
 * show in the studio).
 */
export async function runReminders(
  now = new Date(),
  opts: { force?: boolean } = {},
): Promise<RunResult> {
  const result: RunResult = {
    ran: false,
    people: 0,
    emails: 0,
    reminders: 0,
    failed: 0,
    skipped: 0,
  };
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.reminders) return result;
  const store = getUserStore();
  if (!opts.force && !(await store.takeLease('reminders', LEASE_MS, now))) return result;
  result.ran = true;
  const queue = await store.dueReminderQueues(now.toISOString(), BATCH);
  for (const q of queue) {
    result.people++;
    const jobs = await store.listJobs(q.uid);
    const due = dueNow(jobs, now);
    const stamp = now.toISOString();
    let sent = false;
    if (due.length && !q.off && q.email) {
      const mail = reminderEmail(q.email, due, {
        today: todayIn(q.tz, now),
        unsubscribeUrl: stopUrl(q),
      });
      const r = await sendMail(mail, cfg.support.email);
      if (!r.ok) {
        result.failed++;
        await track('reminder_email_fail');
        await store.putReminderQueue({
          ...q,
          next: new Date(now.getTime() + RETRY_MS).toISOString(),
          updatedAt: stamp,
        });
        continue;
      }
      sent = true;
      result.emails++;
      result.reminders += due.length;
      await track('reminder_email');
    } else if (due.length) {
      result.skipped += due.length;
    }
    // Each due reminder is handled once: emailed, or passed over for someone with emails off.
    const ids = new Set(due.map((d) => d.reminder.id));
    for (const j of jobs) {
      if (!(j.reminders ?? []).some((r) => ids.has(r.id))) continue;
      await store.putJob(q.uid, {
        ...j,
        reminders: j.reminders!.map((r) =>
          ids.has(r.id) ? { ...r, emailedAt: sent ? stamp : `off:${stamp}` } : r,
        ),
      });
    }
    await store.putReminderQueue({
      ...q,
      next: nextDue(await store.listJobs(q.uid)),
      updatedAt: stamp,
    });
  }
  return result;
}
