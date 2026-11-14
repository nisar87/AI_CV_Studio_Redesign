import { NextResponse } from 'next/server';
import { apiError, readJson } from '@/lib/http';
import { loadJobForReminders } from '@/modules/jobs/reminder-route';
import {
  checkDay,
  defaultNote,
  dueAtFor,
  MAX_REMINDERS,
  reminderInput,
  safeZone,
  type Reminder,
} from '@/modules/jobs/reminders';
import { syncQueue } from '@/modules/jobs/reminders-server';
import { track } from '@/modules/metrics/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** POST { on, note?, tz } → { job }: a reminder on this job, emailed at 8:00 on that day. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await loadJobForReminders(ctx);
  if ('error' in r) return r.error;
  const body = await readJson(req, 4 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', r.rid);
  const parsed = reminderInput.safeParse(body.value);
  if (!parsed.success)
    return apiError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid reminder.', r.rid);
  const tz = safeZone(parsed.data.tz);
  const problem = checkDay(parsed.data.on, tz);
  if (problem) return apiError('INVALID_INPUT', problem, r.rid);
  const list = r.job.reminders ?? [];
  if (list.filter((x) => !x.done).length >= MAX_REMINDERS)
    return apiError(
      'LIMIT_REACHED',
      `A job can have up to ${MAX_REMINDERS} open reminders.`,
      r.rid,
      {
        reason: 'limit',
      },
    );
  const now = new Date().toISOString();
  const reminder: Reminder = {
    id: crypto.randomUUID(),
    on: parsed.data.on,
    note: parsed.data.note || defaultNote(r.job),
    done: false,
    dueAt: dueAtFor(parsed.data.on, tz),
    emailedAt: '',
    createdAt: now,
  };
  const job = {
    ...r.job,
    // Kept in date order; at most 30 including done ones (the oldest done ones go first).
    reminders: [...list, reminder]
      .sort((a, b) => a.on.localeCompare(b.on))
      .filter((x, i, all) => !x.done || all.length - i <= 30),
    updatedAt: now,
  };
  await getUserStore().putJob(r.user.uid, job);
  await syncQueue(r.user, { tz });
  await track('reminder_set');
  return NextResponse.json({ job }, noStore);
}
