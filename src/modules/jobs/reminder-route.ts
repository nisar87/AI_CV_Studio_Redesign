import 'server-only';
import { apiError, requestId } from '@/lib/http';
import { getBusinessConfig } from '@/modules/billing/server';
import { currentUser, type SessionUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';
import type { Job } from './schema';

/** Signed in, reminders switched on, and the job is theirs. */
export async function loadJobForReminders(ctx: {
  params: Promise<{ id: string }>;
}): Promise<{ error: Response } | { rid: string; user: SessionUser; job: Job }> {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return { error: apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid) };
  const { value: cfg } = await getBusinessConfig();
  if (!cfg.features.reminders)
    return {
      error: apiError('DISABLED', 'Reminders are switched off right now.', rid, {
        reason: 'disabled',
      }),
    };
  const { id } = await ctx.params;
  const job = /^[\w-]{1,64}$/.test(id) ? await getUserStore().getJob(user.uid, id) : null;
  if (!job) return { error: apiError('NOT_FOUND', 'Job not found.', rid) };
  return { rid, user, job };
}
