'use client';

import type { Job, JobInput } from '@/modules/jobs/schema';

/** Browser helpers for the job tracker API. Errors carry the server's plain-language message. */
export class JobsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const j = (await r.json().catch(() => null)) as
    (T & { error?: undefined }) | { error: { message: string; reason?: string } } | null;
  if (!r.ok || !j || ('error' in j && j.error))
    throw new JobsError(
      (j && 'error' in j && j.error?.message) || 'That didn’t work. Please try again.',
      r.status,
      (j && 'error' in j && j.error?.reason) || undefined,
    );
  return j as T;
}

export const jobsApi = {
  list: () => call<{ jobs: Job[]; max: number }>('/api/jobs'),
  get: (id: string) => call<{ job: Job }>(`/api/jobs/${id}`).then((r) => r.job),
  create: (input: JobInput) =>
    call<{ job: Job }>('/api/jobs', { method: 'POST', body: JSON.stringify(input) }).then(
      (r) => r.job,
    ),
  update: (id: string, patch: Partial<JobInput>) =>
    call<{ job: Job }>(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify(patch) }).then(
      (r) => r.job,
    ),
  remove: (id: string) => call<{ ok: true }>(`/api/jobs/${id}`, { method: 'DELETE' }),
};
