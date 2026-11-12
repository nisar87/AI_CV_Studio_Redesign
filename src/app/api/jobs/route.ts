import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { jobInput, type Job } from '@/modules/jobs/schema';
import { jobAllowance } from '@/modules/jobs/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** GET → { jobs, max } for the signed-in person. */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to use the job tracker.', rid);
  const [jobs, { max }] = await Promise.all([
    getUserStore().listJobs(user.uid),
    jobAllowance(user),
  ]);
  return NextResponse.json({ jobs, max }, noStore);
}

/** POST JobInput → the new job. Refused past the plan's job limit. */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to use the job tracker.', rid);
  const body = await readJson(req, 64 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const parsed = jobInput.safeParse(body.value);
  if (!parsed.success)
    return apiError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid job.', rid);
  const store = getUserStore();
  const [{ max }, existing] = await Promise.all([jobAllowance(user), store.listJobs(user.uid)]);
  if (max !== -1 && existing.length >= max)
    return apiError(
      max === 0 ? 'PREMIUM_REQUIRED' : 'LIMIT_REACHED',
      max === 0
        ? 'The job tracker isn’t included in your plan.'
        : `Your plan tracks up to ${max} jobs. Remove one you no longer need, or get Premium for more.`,
      rid,
      { reason: max === 0 ? 'premium' : 'limit', limit: max },
    );
  const now = new Date().toISOString();
  const job: Job = {
    ...parsed.data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    appliedOn:
      parsed.data.stage === 'applied' && !parsed.data.appliedOn
        ? now.slice(0, 10)
        : parsed.data.appliedOn,
  };
  await store.putJob(user.uid, job);
  return NextResponse.json({ job }, noStore);
}
