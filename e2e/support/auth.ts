import type { APIRequestContext } from '@playwright/test';

export const EMULATOR = 'http://127.0.0.1:9099';
export const PASSWORD = 'Correct-Horse-9!';
export const uniqueEmail = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/** Create an account in the Auth emulator and sign the request context in (session cookie). */
export async function apiSignUp(request: APIRequestContext, email = uniqueEmail('api')) {
  const r = await request.post(
    `${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-key`,
    { data: { email, password: PASSWORD, returnSecureToken: true } },
  );
  const { idToken } = (await r.json()) as { idToken: string };
  const s = await request.post('/api/session', { data: { idToken } });
  if (!s.ok()) throw new Error(`session failed: ${s.status()} ${await s.text()}`);
  return email;
}

export async function setPremium(request: APIRequestContext, premium: boolean) {
  const r = await request.post('/api/test/setup', { data: { premium } });
  if (!r.ok()) throw new Error(`test hook failed: ${r.status()}`);
}

export async function setConfig(request: APIRequestContext, config: unknown) {
  const r = await request.post('/api/test/setup', { data: { config } });
  if (!r.ok()) throw new Error(`config hook failed: ${r.status()} ${await r.text()}`);
}
