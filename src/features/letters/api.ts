'use client';

import { JobsError } from '@/features/jobs/api';
import type { SavedLetter, SavedLetterInput } from '@/modules/letters/schema';
import type { ResumeDocument } from '@/modules/resume/schema';

/** Browser helpers for the letter library. Errors carry the server's plain-language message. */
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

export const lettersApi = {
  list: () => call<{ letters: SavedLetter[]; max: number }>('/api/letters'),
  get: (id: string) => call<{ letter: SavedLetter }>(`/api/letters/${id}`).then((r) => r.letter),
  create: (input: SavedLetterInput) =>
    call<{ letter: SavedLetter }>('/api/letters', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.letter),
  update: (id: string, patch: Partial<SavedLetterInput>) =>
    call<{ letter: SavedLetter }>(`/api/letters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }).then((r) => r.letter),
  remove: (id: string) => call<{ ok: true }>(`/api/letters/${id}`, { method: 'DELETE' }),
  draft: (id: string, document: ResumeDocument, tone: 'warm' | 'formal') =>
    call<{ letter: SavedLetter; findings: number }>(`/api/letters/${id}/draft`, {
      method: 'POST',
      body: JSON.stringify({ document, tone }),
    }),
  async pdf(id: string, document: ResumeDocument): Promise<Blob> {
    const r = await fetch(`/api/letters/${id}/pdf`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document }),
    });
    if (r.ok) return r.blob();
    const j = (await r.json().catch(() => null)) as {
      error?: { message: string; reason?: string };
    } | null;
    throw new JobsError(
      j?.error?.message ?? 'We couldn’t create the PDF just now.',
      r.status,
      j?.error?.reason,
    );
  },
};
