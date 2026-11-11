'use client';

/** Small fetch helpers for the Admin Console (all routes are admin-checked on the server). */
export async function adminGet<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json() as Promise<T>;
}

export async function adminSend<T>(
  path: string,
  method: 'POST' | 'PUT',
  body: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json() as Promise<T>;
}

async function errorMessage(r: Response) {
  const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
  return j?.error?.message ?? `Request failed (${r.status})`;
}
