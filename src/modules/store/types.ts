import type { ResumeDocument } from '@/modules/resume/schema';

/**
 * Server-side storage of a user's documents (docs/product/studio-master-plan.md §4.1).
 * Only the server touches it, with the user id from a verified session.
 */
export type StoredDoc = {
  id: string;
  /** The document's own updatedAt (client edit time), used for last-edit-wins. */
  updatedAt: string;
  deleted: boolean;
  doc: ResumeDocument | null;
};

export type DocSummary = Omit<StoredDoc, 'doc'> & { title: string };

export type PutResult =
  | { ok: true; stored: StoredDoc }
  | { ok: false; reason: 'conflict'; current: StoredDoc }
  | { ok: false; reason: 'limit' };

export interface UserStore {
  touchUser(uid: string, info: { email: string | null; name: string | null }): Promise<void>;
  listDocs(uid: string): Promise<DocSummary[]>;
  getDoc(uid: string, id: string): Promise<StoredDoc | null>;
  /** Saves if the incoming edit is not older than the stored one; keeps the replaced version. */
  putDoc(uid: string, doc: ResumeDocument, maxDocs: number): Promise<PutResult>;
  deleteDoc(uid: string, id: string, at: string): Promise<void>;
  listVersions(uid: string, id: string): Promise<{ savedAt: string; doc: ResumeDocument }[]>;

  // Billing (studio-master-plan §4.3) — written only by the server.
  getPass(uid: string): Promise<Pass | null>;
  setPass(uid: string, pass: Pass | null): Promise<void>;
  getUsage(uid: string, month: string): Promise<Record<string, number>>;
  /** Atomically increments `key` if it is below `limit` (-1 = unlimited). */
  reserveUsage(uid: string, month: string, key: string, limit: number): Promise<boolean>;
  releaseUsage(uid: string, month: string, key: string): Promise<void>;

  // Business configuration with history (Admin Console).
  getConfig(area: string): Promise<{ version: number; value: unknown } | null>;
  saveConfig(area: string, value: unknown, by: string): Promise<number>;
  listConfigVersions(area: string): Promise<ConfigVersion[]>;
}

export type Pass = {
  plan: 'premium';
  /** ISO date-time; access ends after this moment. */
  expiresAt: string;
  source: 'manual' | 'admin';
  grantedBy: string;
  grantedAt: string;
  note?: string;
};

export type ConfigVersion = { version: number; savedAt: string; savedBy: string; value: unknown };

export const MAX_VERSIONS = 10;
