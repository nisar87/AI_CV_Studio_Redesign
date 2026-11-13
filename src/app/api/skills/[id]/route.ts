import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { currentUser } from '@/modules/identity/session';
import { progressInput, type SkillPlan } from '@/modules/skills/gap';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { headers: { 'Cache-Control': 'no-store' } };
type Ctx = { params: Promise<{ id: string }> };

async function load(ctx: Ctx) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return { error: apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid) };
  const { id } = await ctx.params;
  const plan = /^[\w-]{1,64}$/.test(id) ? await getUserStore().getSkillPlan(user.uid, id) : null;
  if (!plan) return { error: apiError('NOT_FOUND', 'Plan not found.', rid) };
  return { rid, user, plan };
}

export async function GET(_req: Request, ctx: Ctx) {
  const r = await load(ctx);
  if ('error' in r) return r.error;
  return NextResponse.json({ plan: r.plan }, noStore);
}

/** PUT { steps: ['todo' | 'learning' | 'done', …] } → the plan with the person's progress. */
export async function PUT(req: Request, ctx: Ctx) {
  const r = await load(ctx);
  if ('error' in r) return r.error;
  const body = await readJson(req, 4 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', r.rid);
  const parsed = progressInput.safeParse(body.value);
  if (!parsed.success) return apiError('INVALID_INPUT', 'Invalid progress.', r.rid);
  const plan: SkillPlan = {
    ...r.plan,
    plan: r.plan.plan.map((s, i) => ({ ...s, status: parsed.data.steps[i] ?? s.status })),
    updatedAt: new Date().toISOString(),
  };
  await getUserStore().putSkillPlan(r.user.uid, plan);
  return NextResponse.json({ plan }, noStore);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const r = await load(ctx);
  if ('error' in r) return r.error;
  await getUserStore().deleteSkillPlan(r.user.uid, r.plan.id);
  return NextResponse.json({ ok: true }, noStore);
}
