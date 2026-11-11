import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import { FirestoreUserStore } from './firestore';
import { MemoryUserStore } from './memory';
import type { UserStore } from './types';

/** DATA_STORE=memory|firestore. Unset: Firestore in production, memory otherwise. */
export function getUserStore(): UserStore {
  const g = globalThis as unknown as { __cvStudioStore?: UserStore };
  if (g.__cvStudioStore) return g.__cvStudioStore;
  const kind =
    process.env.DATA_STORE ?? (process.env.NODE_ENV === 'production' ? 'firestore' : 'memory');
  g.__cvStudioStore = kind === 'memory' ? new MemoryUserStore() : new FirestoreUserStore(adminDb());
  return g.__cvStudioStore;
}

/** Safety cap until plans set per-plan limits (R1.2). */
export const MAX_DOCS_PER_USER = 200;
