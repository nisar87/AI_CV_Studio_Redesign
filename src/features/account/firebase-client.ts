'use client';

import type { Auth, User } from 'firebase/auth';

/**
 * Firebase Auth in the browser, loaded only when needed. After any sign-in the ID token is
 * exchanged for a server session cookie (POST /api/session); the server never trusts the client.
 */
type PublicConfig = {
  firebase: { apiKey: string; authDomain: string; projectId: string; appId?: string };
  authEmulatorUrl?: string;
};

let authPromise: Promise<Auth> | null = null;

export function getClientAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const cfg = (await fetch('/api/public-config').then((r) => r.json())) as PublicConfig;
    const [{ initializeApp, getApps }, authMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const app = getApps()[0] ?? initializeApp(cfg.firebase);
    const auth = authMod.initializeAuth(app, {
      persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence],
      popupRedirectResolver: authMod.browserPopupRedirectResolver,
    });
    if (cfg.authEmulatorUrl)
      authMod.connectAuthEmulator(auth, cfg.authEmulatorUrl, { disableWarnings: true });
    return auth;
  })();
  return authPromise;
}

async function createServerSession(user: User) {
  const idToken = await user.getIdToken(true);
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new AuthUiError(
      j?.error?.message ?? 'We couldn’t sign you in just now. Please try again.',
    );
  }
}

export class AuthUiError extends Error {}

/** Plain-language messages for Firebase Auth error codes. */
export function authMessage(err: unknown): string {
  if (err instanceof AuthUiError) return err.message;
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'That email and password don’t match. Check them and try again.',
    'auth/invalid-login-credentials':
      'That email and password don’t match. Check them and try again.',
    'auth/wrong-password': 'That email and password don’t match. Check them and try again.',
    'auth/user-not-found': 'That email and password don’t match. Check them and try again.',
    'auth/email-already-in-use':
      'An account with this email already exists. Try signing in instead.',
    'auth/invalid-email': 'This email address doesn’t look right.',
    'auth/weak-password': 'Please choose a stronger password.',
    'auth/password-does-not-meet-requirements':
      'Please choose a password that meets all the requirements below.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/popup-closed-by-user': 'The Google window was closed before sign-in finished.',
    'auth/popup-blocked':
      'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
    'auth/network-request-failed': 'We couldn’t reach the sign-in service. Check your connection.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/account-exists-with-different-credential':
      'This email is already registered with a password. Sign in with your password instead.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

export async function signInWithEmail(email: string, password: string) {
  const auth = await getClientAuth();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await createServerSession(cred.user);
}

export async function signUpWithEmail(email: string, password: string) {
  const auth = await getClientAuth();
  const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await sendEmailVerification(cred.user).catch(() => {});
  await createServerSession(cred.user);
}

export async function signInWithGoogle() {
  const auth = await getClientAuth();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  await createServerSession(cred.user);
}

export async function sendReset(email: string) {
  const auth = await getClientAuth();
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, email.trim()).catch((e: { code?: string }) => {
    // Do not reveal whether an account exists.
    if (e.code !== 'auth/user-not-found') throw e;
  });
}

export async function resendVerification() {
  const auth = await getClientAuth();
  const { sendEmailVerification } = await import('firebase/auth');
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

/** After the user clicks the verification link: refresh the token so the session sees it. */
export async function refreshVerification(): Promise<boolean> {
  const auth = await getClientAuth();
  const u = auth.currentUser;
  if (!u) return false;
  await u.reload();
  if (u.emailVerified) await createServerSession(u);
  return u.emailVerified;
}

export async function signOutEverywhere(everywhere = false) {
  await fetch(`/api/session${everywhere ? '?everywhere=1' : ''}`, { method: 'DELETE' });
  const auth = await getClientAuth();
  const { signOut } = await import('firebase/auth');
  await signOut(auth).catch(() => {});
}

/** Password rules, matching the Firebase project's password policy. */
export const PASSWORD_RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'len', label: 'At least 10 characters', test: (p) => p.length >= 10 },
  { id: 'upper', label: 'An uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'num', label: 'A number (0–9)', test: (p) => /\d/.test(p) },
  { id: 'sym', label: 'A symbol (for example ! ? # @)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];
