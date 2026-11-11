import 'server-only';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin for the server. On Firebase App Hosting (Cloud Run) it uses the backend's
 * service account (Application Default Credentials); locally and in tests it talks to the
 * Auth emulator when FIREBASE_AUTH_EMULATOR_HOST is set.
 */
export function firebaseProjectId(env: NodeJS.ProcessEnv = process.env): string {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID;
  try {
    const cfg = env.FIREBASE_CONFIG
      ? (JSON.parse(env.FIREBASE_CONFIG) as { projectId?: string })
      : {};
    if (cfg.projectId) return cfg.projectId;
  } catch {
    /* fall through */
  }
  return env.GOOGLE_CLOUD_PROJECT || 'ai-cv-studio';
}

let app: App | null = null;
function adminApp(): App {
  if (app) return app;
  app = getApps()[0] ?? initializeApp({ projectId: firebaseProjectId() });
  return app;
}

export const adminAuth = () => getAuth(adminApp());
let dbReady = false;
export function adminDb() {
  const db = getFirestore(adminApp());
  if (!dbReady) {
    // CV documents contain optional fields; skip undefined values instead of failing writes.
    db.settings({ ignoreUndefinedProperties: true });
    dbReady = true;
  }
  return db;
}
