import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { applyJobPatch } from '@/modules/jobs/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const noStore = { headers: { 'Cache-Control': 'no-store' } };

async function load(ctx: Ctx) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return { error: apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid) };
  const { id } = await ctx.params;
  if (!/^[\w-]{1,64}$/.test(id)) return { error: apiError('NOT_FOUND', 'Job not found.', rid) };
  const job = await getUserStore().getJob(user.uid, id);
  if (!job) return { error: apiError('NOT_FOUND', 'Job not found.', rid) };
  return { user, job, rid };
}

export async function GET(_req: Request, ctx: Ctx) {
  const r = await load(ctx);
  if ('error' in r) return r.error;
  return NextResponse.json({ job: r.job }, noStore);
}

/** PUT partial JobInput → updated job. */
export async function PUT(req: Request, ctx: Ctx) {
  const r = await load(ctx);
  if ('error' in r) return r.error;
  const body = await readJson(req, 64 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', r.rid);
  const next = applyJobPatch(r.job, body.value);
  if ('error' in next) return apiError('INVALID_INPUT', next.error, r.rid);
  await getUserStore().putJob(r.user.uid, next);
  return NextResponse.json({ job: next }, noStore);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const r = await load(ctx);
  if ('error' in r) return r.error;
  await getUserStore().deleteJob(r.user.uid, r.job.id);
  return NextResponse.json({ ok: true }, noStore);
}
