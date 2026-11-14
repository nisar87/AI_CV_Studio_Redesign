import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, readJson } from '@/lib/http';
import { loadJobForReminders } from '@/modules/jobs/reminder-route';
import { syncQueue } from '@/modules/jobs/reminders-server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };
type Ctx = { params: Promise<{ id: string; rid: string }> };
const patch = z.object({
  done: z.boolean().optional(),
  note: z.string().trim().max(200).optional(),
});

/** PUT { done?, note? } → { job }. */
export async function PUT(req: Request, ctx: Ctx) {
  const r = await loadJobForReminders(ctx);
  if ('error' in r) return r.error;
  const { rid } = await ctx.params;
  const body = await readJson(req, 4 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', r.rid);
  const p = patch.safeParse(body.value);
  if (!p.success) return apiError('INVALID_INPUT', 'Invalid reminder.', r.rid);
  if (!(r.job.reminders ?? []).some((x) => x.id === rid))
    return apiError('NOT_FOUND', 'Reminder not found.', r.rid);
  const job = {
    ...r.job,
    reminders: r.job.reminders!.map((x) =>
      x.id === rid
        ? {
            ...x,
            ...(p.data.done !== undefined ? { done: p.data.done } : {}),
            ...(p.data.note ? { note: p.data.note } : {}),
          }
        : x,
    ),
    updatedAt: new Date().toISOString(),
  };
  await getUserStore().putJob(r.user.uid, job);
  await syncQueue(r.user);
  return NextResponse.json({ job }, noStore);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const r = await loadJobForReminders(ctx);
  if ('error' in r) return r.error;
  const { rid } = await ctx.params;
  const job = {
    ...r.job,
    reminders: (r.job.reminders ?? []).filter((x) => x.id !== rid),
    updatedAt: new Date().toISOString(),
  };
  await getUserStore().putJob(r.user.uid, job);
  await syncQueue(r.user);
  return NextResponse.json({ job }, noStore);
}
