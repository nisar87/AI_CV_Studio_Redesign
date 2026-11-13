import type { Job } from '@/modules/jobs/schema';
import type { SavedLetter } from '@/modules/letters/schema';
import type { CoachThread } from '@/modules/coach/thread';
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
  /**
   * Account deletion: removes the user record, every CV and version, the pass and usage.
   * Payment requests are kept for accounting with the email removed.
   */
  deleteUserData(uid: string): Promise<void>;
  // Job tracker
  listJobs(uid: string): Promise<Job[]>;
  getJob(uid: string, id: string): Promise<Job | null>;
  putJob(uid: string, job: Job): Promise<void>;
  deleteJob(uid: string, id: string): Promise<void>;

  // Career coach (R9): one conversation per account.
  getCoachThread(uid: string): Promise<CoachThread | null>;
  putCoachThread(uid: string, t: CoachThread): Promise<void>;
  deleteCoachThread(uid: string): Promise<void>;

  // Letter library (R8.2)
  listLetters(uid: string): Promise<SavedLetter[]>;
  getLetter(uid: string, id: string): Promise<SavedLetter | null>;
  putLetter(uid: string, letter: SavedLetter): Promise<void>;
  deleteLetter(uid: string, id: string): Promise<void>;
  /** Adds to today's event counters (metrics/{yyyy-mm-dd}); names are [a-z0-9_]. */
  bumpMetrics(day: string, counts: Record<string, number>): Promise<void>;
  /** Daily counters for days in [from, to] (inclusive, yyyy-mm-dd), oldest first. */
  getMetrics(from: string, to: string): Promise<{ day: string; counts: Record<string, number> }[]>;
  /** A pending or approved payment request with this transaction reference (normalised). */
  findPaymentByReference(referenceKey: string): Promise<PaymentRequest | null>;
  /** Has this account used the studio before (signed in at least once)? */
  knownUser(uid: string): Promise<boolean>;
  listDocs(uid: string): Promise<DocSummary[]>;
  getDoc(uid: string, id: string): Promise<StoredDoc | null>;
  /** Saves if the incoming edit is not older than the stored one; keeps the replaced version. */
  putDoc(uid: string, doc: ResumeDocument, maxDocs: number): Promise<PutResult>;
  deleteDoc(uid: string, id: string, at: string): Promise<void>;
  // Read-only share links for CVs (R3). Deleted with the document and with the account.
  createShare(share: Share): Promise<void>;
  getShare(token: string): Promise<Share | null>;
  listShares(uid: string): Promise<Share[]>;
  /** Saved designs ("Save as my design", R6), newest first. Stored under the account. */
  listDesigns(uid: string): Promise<SavedDesign[]>;
  putDesign(d: SavedDesign): Promise<void>;
  deleteDesign(uid: string, id: string): Promise<boolean>;
  updateShare(token: string, patch: Partial<Pick<Share, 'enabled'>>): Promise<void>;
  deleteShare(token: string): Promise<void>;
  /** Counts a visit (best effort). */
  bumpShareViews(token: string, at: string): Promise<void>;
  // Public portfolio page (R3): one per account, at /p/{slug}.
  getPortfolio(slug: string): Promise<Portfolio | null>;
  getPortfolioOf(uid: string): Promise<Portfolio | null>;
  /** Saves the account's portfolio; false if the slug belongs to someone else. */
  putPortfolio(p: Portfolio): Promise<boolean>;
  deletePortfolioOf(uid: string): Promise<void>;
  bumpPortfolioViews(slug: string): Promise<void>;
  listVersions(uid: string, id: string): Promise<{ savedAt: string; doc: ResumeDocument }[]>;

  // Billing (studio-master-plan §4.3) — written only by the server.
  getPass(uid: string): Promise<Pass | null>;
  setPass(uid: string, pass: Pass | null): Promise<void>;
  getUsage(uid: string, month: string): Promise<Record<string, number>>;
  /** Atomically increments `key` if it is below `limit` (-1 = unlimited). */
  /** Adds `weight` (default 1) if it stays within `limit` (-1 = unlimited). */
  reserveUsage(
    uid: string,
    month: string,
    key: string,
    limit: number,
    weight?: number,
  ): Promise<boolean>;
  releaseUsage(uid: string, month: string, key: string, weight?: number): Promise<void>;

  // Business configuration with history (Admin Console).
  getConfig(area: string): Promise<{ version: number; value: unknown } | null>;
  saveConfig(area: string, value: unknown, by: string): Promise<number>;
  listConfigVersions(area: string): Promise<ConfigVersion[]>;

  // Admin Console
  writeAudit(entry: Omit<AuditEntry, 'id'>): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;
  listPasses(): Promise<(Pass & { uid: string })[]>;
  usageTotals(month: string): Promise<Record<string, number>>;
  // Coupons and referrals (R4)
  /** Purchases made with a coupon that are pending or approved. */
  countCouponUses(code: string): Promise<number>;
  /** The account's own invite code, creating it on first use. */
  referralCodeOf(uid: string, make: () => string): Promise<string>;
  /** Who owns an invite code. */
  referralOwner(code: string): Promise<string | null>;
  /** Records who invited this account (only once, never yourself). */
  setReferredBy(uid: string, referrerUid: string): Promise<void>;
  getReferredBy(uid: string): Promise<string | null>;
  /** How many accounts joined through this person's link. */
  countReferred(uid: string): Promise<number>;
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
    d: { status: 'approved' | 'rejected' | 'cancelled'; by: string; reason?: string },
  ): Promise<PaymentRequest | null>;
  userStats(): Promise<{
    total: number;
    recent: { uid: string; email: string | null; lastSeenAt: string | null }[];
  }>;
}

/** A public web page made from one CV. Contact details show only if the owner chooses. */
export type Portfolio = {
  slug: string;
  uid: string;
  docId: string;
  published: boolean;
  showEmail: boolean;
  showPhone: boolean;
  createdAt: string;
  updatedAt: string;
  views: number;
  /** Opens per day (yyyy-mm-dd → count), for the Presence hub. */
  daily?: Record<string, number>;
};

/** A private, read-only link to the latest version of one CV. */
export type SavedDesign = {
  id: string;
  uid: string;
  name: string;
  /** A Design Spec v2 (validated with parseSpec when read and written). */
  spec: unknown;
  createdAt: string;
};

export type Share = {
  token: string;
  uid: string;
  docId: string;
  enabled: boolean;
  createdAt: string;
  views: number;
  lastViewedAt: string | null;
  /** Opens per day (yyyy-mm-dd → count), for the Presence hub. */
  daily?: Record<string, number>;
};

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
  source: 'manual' | 'admin' | 'referral';
  grantedBy: string;
  grantedAt: string;
  note?: string;
};

/** `cancelled`: the buyer withdrew the order before it was checked. */
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
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
  /** Reference lower-cased with spaces and punctuation removed, for the duplicate check. */
  referenceKey?: string;
  note?: string;
  /** Short order number the buyer quotes with their payment screenshot (e.g. CV-7KQ2M9). */
  orderNo?: string;
  /** Buyer's mobile number, to match the WhatsApp message. */
  phone?: string;
  /** Price before a coupon (R4); `pricePkr` is what the buyer pays. */
  listPricePkr?: number;
  couponCode?: string;
  /** Extra days because a friend invited them (first purchase). */
  welcomeDays?: number;
  /** Who invited the buyer; rewarded when this, their first purchase, is approved. */
  referrerUid?: string;
  status: PaymentStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
};

export type ConfigVersion = { version: number; savedAt: string; savedBy: string; value: unknown };

export const MAX_VERSIONS = 10;
