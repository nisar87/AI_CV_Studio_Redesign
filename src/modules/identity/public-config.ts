import 'server-only';
import { firebaseProjectId } from '@/lib/firebase-admin';

/** Firebase web config is public by design; App Hosting provides it, with project defaults. */
const DEFAULT_WEB_CONFIG = {
  apiKey: 'AIzaSyAmBU-g-BvTKD-diwwez0jDhsY8Hz4WFRM',
  authDomain: 'ai-cv-studio.firebaseapp.com',
  projectId: 'ai-cv-studio',
  appId: '1:104476468092:web:a244062e2f43d47fbbbaf9',
};

export type PublicConfig = {
  firebase: { apiKey: string; authDomain: string; projectId: string; appId?: string };
  /** Set only in local development and tests. */
  authEmulatorUrl?: string;
};

export function publicConfig(env: NodeJS.ProcessEnv = process.env): PublicConfig {
  let web: Partial<PublicConfig['firebase']> = {};
  try {
    if (env.FIREBASE_WEBAPP_CONFIG) web = JSON.parse(env.FIREBASE_WEBAPP_CONFIG);
  } catch {
    /* use defaults */
  }
  const emulator = env.FIREBASE_AUTH_EMULATOR_HOST;
  return {
    firebase: {
      apiKey: web.apiKey ?? (emulator ? 'emulator-key' : DEFAULT_WEB_CONFIG.apiKey),
      authDomain: web.authDomain ?? DEFAULT_WEB_CONFIG.authDomain,
      projectId: emulator
        ? firebaseProjectId(env)
        : (web.projectId ?? DEFAULT_WEB_CONFIG.projectId),
      appId: web.appId ?? DEFAULT_WEB_CONFIG.appId,
    },
    ...(emulator ? { authEmulatorUrl: `http://${emulator}` } : {}),
  };
}
