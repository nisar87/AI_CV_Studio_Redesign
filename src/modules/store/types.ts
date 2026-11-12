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
  /** Has this account used the studio before (signed in at least once)? */
  knownUser(uid: string): Promise<boolean>;
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

  // Admin Console
  writeAudit(entry: Omit<AuditEntry, 'id'>): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;
  listPasses(): Promise<(Pass & { uid: string })[]>;
  usageTotals(month: string): Promise<Record<string, number>>;
  // Premium purchase requests (manual payments, R1.4)
  createPaymentRequest(r: Omit<PaymentRequest, 'id'>): Promise<PaymentRequest>;
  /** Newest first. Filter by owner or status; `limit` caps the result. */
  listPaymentRequests(q: {
    uid?: string;
    status?: PaymentStatus;
    limit: number;
  }): Promise<PaymentRequest[]>;
  /** Moves a pending request to approved/rejected; null if it is not pending (already decided). */
  decidePaymentRequest(
    id: string,
    d: { status: 'approved' | 'rejected'; by: string; reason?: string },
  ): Promise<PaymentRequest | null>;
  userStats(): Promise<{
    total: number;
    recent: { uid: string; email: string | null; lastSeenAt: string | null }[];
  }>;
}

export type AuditEntry = {
  id: string;
  at: string;
  by: string;
  action: string;
  target: string;
  detail?: unknown;
};

export type Pass = {
  plan: 'premium';
  /** ISO date-time; access ends after this moment. */
  expiresAt: string;
  source: 'manual' | 'admin';
  grantedBy: string;
  grantedAt: string;
  note?: string;
};

export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type PaymentRequest = {
  id: string;
  uid: string;
  email: string | null;
  passId: string;
  passLabel: string;
  days: number;
  pricePkr: number;
  methodId: string;
  methodLabel: string;
  /** Transaction id / reference the buyer copied from their banking app. */
  reference: string;
  note?: string;
  status: PaymentStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
};

export type ConfigVersion = { version: number; savedAt: string; savedBy: string; value: unknown };

export const MAX_VERSIONS = 10;
