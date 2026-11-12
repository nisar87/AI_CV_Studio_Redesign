import { newId } from './create';
import type { ResumeDocument } from './schema';

/**
 * Career profile (Release 2): one master record per account, stored as a CV with role "profile".
 * CVs — including ones tailored for a job — are copies made from it, so the facts are kept and
 * updated in one place.
 */
export function makeProfile(from: ResumeDocument, now = new Date()): ResumeDocument {
  const t = now.toISOString();
  const copy = structuredClone(from);
  delete copy.jobId;
  delete copy.parentId;
  return {
    ...copy,
    id: newId(),
    role: 'profile',
    title: 'Career profile',
    createdAt: t,
    updatedAt: t,
  };
}

export function cvFromProfile(
  profile: ResumeDocument,
  opts: { title?: string; jobId?: string; now?: Date } = {},
): ResumeDocument {
  const t = (opts.now ?? new Date()).toISOString();
  const copy = structuredClone(profile);
  delete copy.role;
  return {
    ...copy,
    id: newId(),
    parentId: profile.id,
    ...(opts.jobId ? { jobId: opts.jobId } : {}),
    title: (opts.title ?? (profile.basics.name ? `${profile.basics.name} — CV` : 'My CV')).slice(
      0,
      120,
    ),
    createdAt: t,
    updatedAt: t,
  };
}

export const isProfile = (d: Pick<ResumeDocument, 'role'>) => d.role === 'profile';
