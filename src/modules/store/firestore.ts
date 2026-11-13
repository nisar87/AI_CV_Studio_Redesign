import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Job } from '@/modules/jobs/schema';
import type { SavedLetter } from '@/modules/letters/schema';
import type { ResumeDocument } from '@/modules/resume/schema';
import {
  MAX_VERSIONS,
  type DocSummary,
  type PutResult,
  type StoredDoc,
  type UserStore,
  type Pass,
  type ConfigVersion,
  type AuditEntry,
  type PaymentRequest,
  type PaymentStatus,
  type Share,
  type Portfolio,
  SavedDesign,
} from './types';

/**
 * Firestore layout (owned by the user, written only by the server):
 *   users/{uid}                              email, name, lastSeenAt (merged; old app fields untouched)
 *   users/{uid}/documents/{id}               { updatedAt, deleted, title, doc, serverUpdatedAt }
 *   users/{uid}/documents/{id}/versions/{v}  { savedAt, doc }   (last 10)
 *   passes/{uid}                             Pass (Premium access until expiresAt) + uid, email
 *   usage/{uid}_{yyyy-mm}                    { uid, month, 'pdf.download': n, ... }
 *   users/{uid}/jobs/{id}                    Job (tracker; deleted with the account)
 *   users/{uid}/letters/{id}                 SavedLetter (letter library; deleted with the account)
 *   portfolios/{slug}                        Portfolio (public page; one per account)
 *   referralCodes/{code}                     { uid }  (invite link; users/{uid}.referralCode, .referredBy)
 *   shares/{token}                           Share (read-only CV link; deleted with the CV/account)
 *   paymentRequests/{auto}                   PaymentRequest (Premium purchase, manual payment)
 *   adminAudit/{auto}                        { at, by, action, target, detail }
 *   config/{area}                            { version, value, savedAt, savedBy }
 *   config/{area}/versions/{version}         history for restore
 */
export class FirestoreUserStore implements UserStore {
  constructor(private readonly db: Firestore) {}

  private col(uid: string) {
    return this.db.collection('users').doc(uid).collection('documents');
  }

  async touchUser(uid: string, info: { email: string | null; name: string | null }) {
    await this.db
      .collection('users')
      .doc(uid)
      .set({ ...info, lastSeenAt: FieldValue.serverTimestamp(), studioV2: true }, { merge: true });
  }

  private jobsCol(uid: string) {
    return this.db.collection('users').doc(uid).collection('jobs');
  }
  async listJobs(uid: string) {
    const snap = await this.jobsCol(uid).orderBy('updatedAt', 'desc').limit(500).get();
    return snap.docs.map((d) => d.data() as Job);
  }
  async getJob(uid: string, id: string) {
    const s = await this.jobsCol(uid).doc(id).get();
    return s.exists ? (s.data() as Job) : null;
  }
  async putJob(uid: string, job: Job) {
    await this.jobsCol(uid).doc(job.id).set(job);
  }
  async deleteJob(uid: string, id: string) {
    await this.jobsCol(uid).doc(id).delete();
  }

  private lettersCol(uid: string) {
    return this.db.collection('users').doc(uid).collection('letters');
  }
  async listLetters(uid: string) {
    const snap = await this.lettersCol(uid).orderBy('updatedAt', 'desc').limit(500).get();
    return snap.docs.map((d) => d.data() as SavedLetter);
  }
  async getLetter(uid: string, id: string) {
    const s = await this.lettersCol(uid).doc(id).get();
    return s.exists ? (s.data() as SavedLetter) : null;
  }
  async putLetter(uid: string, letter: SavedLetter) {
    await this.lettersCol(uid).doc(letter.id).set(letter);
  }
  async deleteLetter(uid: string, id: string) {
    await this.lettersCol(uid).doc(id).delete();
  }

  async bumpMetrics(day: string, counts: Record<string, number>) {
    const inc = Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, FieldValue.increment(v)]),
    );
    await this.db.collection('metrics').doc(day).set({ day, counts: inc }, { merge: true });
  }
  async getMetrics(from: string, to: string) {
    const snap = await this.db
      .collection('metrics')
      .where('day', '>=', from)
      .where('day', '<=', to)
      .get();
    return snap.docs
      .map((d) => ({
        day: d.get('day') as string,
        counts: (d.get('counts') ?? {}) as Record<string, number>,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }
  async findPaymentByReference(referenceKey: string) {
    const snap = await this.db
      .collection('paymentRequests')
      .where('referenceKey', '==', referenceKey)
      .limit(5)
      .get();
    const hit = snap.docs.find((d) => d.get('status') !== 'rejected');
    return hit ? { id: hit.id, ...(hit.data() as Omit<PaymentRequest, 'id'>) } : null;
  }

  async deleteUserData(uid: string) {
    // users/{uid} with every document and version below it.
    await this.db.recursiveDelete(this.db.collection('users').doc(uid));
    await this.db.collection('passes').doc(uid).delete();
    const usage = await this.db.collection('usage').where('uid', '==', uid).get();
    const shares = await this.db.collection('shares').where('uid', '==', uid).get();
    const portfolios = await this.db.collection('portfolios').where('uid', '==', uid).get();
    const codes = await this.db.collection('referralCodes').where('uid', '==', uid).get();
    const payments = await this.db.collection('paymentRequests').where('uid', '==', uid).get();
    const batch = this.db.batch();
    usage.docs.forEach((d) => batch.delete(d.ref));
    shares.docs.forEach((d) => batch.delete(d.ref));
    portfolios.docs.forEach((d) => batch.delete(d.ref));
    codes.docs.forEach((d) => batch.delete(d.ref));
    payments.docs.forEach((d) => batch.update(d.ref, { email: null }));
    await batch.commit();
  }

  async countCouponUses(code: string) {
    // Equality filter only (no composite index); status is checked here.
    const snap = await this.db.collection('paymentRequests').where('couponCode', '==', code).get();
    return snap.docs.filter((d) => ['pending', 'approved'].includes(d.get('status') as string))
      .length;
  }
  async referralCodeOf(uid: string, make: () => string) {
    const user = this.db.collection('users').doc(uid);
    const existing = (await user.get()).get('referralCode') as string | undefined;
    if (existing) return existing;
    for (let i = 0; i < 5; i++) {
      const code = make();
      const ok = await this.db.runTransaction(async (tx) => {
        const ref = this.db.collection('referralCodes').doc(code);
        if ((await tx.get(ref)).exists) return false;
        tx.set(ref, { uid });
        tx.set(user, { referralCode: code }, { merge: true });
        return true;
      });
      if (ok) return code;
    }
    throw new Error('Could not create an invite code');
  }
  async referralOwner(code: string) {
    const s = await this.db.collection('referralCodes').doc(code).get();
    return s.exists ? (s.get('uid') as string) : null;
  }
  async setReferredBy(uid: string, referrerUid: string) {
    if (uid === referrerUid) return;
    const ref = this.db.collection('users').doc(uid);
    await this.db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (cur.get('referredBy')) return;
      tx.set(ref, { referredBy: referrerUid }, { merge: true });
    });
  }
  async getReferredBy(uid: string) {
    return ((await this.db.collection('users').doc(uid).get()).get('referredBy') as string) ?? null;
  }
  async countReferred(uid: string) {
    const agg = await this.db.collection('users').where('referredBy', '==', uid).count().get();
    return agg.data().count;
  }

  private portfolios() {
    return this.db.collection('portfolios');
  }
  async getPortfolio(slug: string) {
    const s = await this.portfolios().doc(slug).get();
    return s.exists ? (s.data() as Portfolio) : null;
  }
  async getPortfolioOf(uid: string) {
    const snap = await this.portfolios().where('uid', '==', uid).limit(1).get();
    return snap.empty ? null : (snap.docs[0]!.data() as Portfolio);
  }
  async putPortfolio(p: Portfolio) {
    return this.db.runTransaction(async (tx) => {
      const ref = this.portfolios().doc(p.slug);
      const [taken, mine] = await Promise.all([
        tx.get(ref),
        tx.get(this.portfolios().where('uid', '==', p.uid)),
      ]);
      if (taken.exists && taken.get('uid') !== p.uid) return false;
      mine.docs.filter((d) => d.id !== p.slug).forEach((d) => tx.delete(d.ref));
      tx.set(ref, p);
      return true;
    });
  }
  async deletePortfolioOf(uid: string) {
    const snap = await this.portfolios().where('uid', '==', uid).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  async bumpPortfolioViews(slug: string) {
    await this.portfolios()
      .doc(slug)
      .update({ views: FieldValue.increment(1) });
  }

  private designs(uid: string) {
    return this.db.collection('users').doc(uid).collection('designs');
  }
  async listDesigns(uid: string) {
    const snap = await this.designs(uid).orderBy('createdAt', 'desc').limit(100).get();
    return snap.docs.map((d) => d.data() as SavedDesign);
  }
  async putDesign(d: SavedDesign) {
    await this.designs(d.uid).doc(d.id).set(d);
  }
  async deleteDesign(uid: string, id: string) {
    const ref = this.designs(uid).doc(id);
    const had = (await ref.get()).exists;
    await ref.delete();
    return had;
  }
  private shares() {
    return this.db.collection('shares');
  }
  async createShare(share: Share) {
    await this.shares().doc(share.token).create(share);
  }
  async getShare(token: string) {
    const s = await this.shares().doc(token).get();
    return s.exists ? (s.data() as Share) : null;
  }
  async listShares(uid: string) {
    const snap = await this.shares().where('uid', '==', uid).get();
    return snap.docs.map((d) => d.data() as Share);
  }
  async updateShare(token: string, patch: Partial<Pick<Share, 'enabled'>>) {
    await this.shares().doc(token).update(patch);
  }
  async deleteShare(token: string) {
    await this.shares().doc(token).delete();
  }
  async bumpShareViews(token: string, at: string) {
    await this.shares()
      .doc(token)
      .update({ views: FieldValue.increment(1), lastViewedAt: at });
  }

  async knownUser(uid: string) {
    return (await this.db.collection('users').doc(uid).get()).exists;
  }

  async listDocs(uid: string): Promise<DocSummary[]> {
    const snap = await this.col(uid).select('updatedAt', 'deleted', 'title').get();
    return snap.docs.map((d) => ({
      id: d.id,
      updatedAt: String(d.get('updatedAt') ?? ''),
      deleted: Boolean(d.get('deleted')),
      title: String(d.get('title') ?? ''),
    }));
  }

  async getDoc(uid: string, id: string): Promise<StoredDoc | null> {
    const s = await this.col(uid).doc(id).get();
    if (!s.exists) return null;
    return {
      id,
      updatedAt: String(s.get('updatedAt') ?? ''),
      deleted: Boolean(s.get('deleted')),
      doc: (s.get('doc') as ResumeDocument | undefined) ?? null,
    };
  }

  async putDoc(uid: string, doc: ResumeDocument, maxDocs: number): Promise<PutResult> {
    const ref = this.col(uid).doc(doc.id);
    const result = await this.db.runTransaction(async (tx): Promise<PutResult> => {
      const cur = await tx.get(ref);
      const curUpdated = String(cur.get('updatedAt') ?? '');
      const curDeleted = Boolean(cur.get('deleted'));
      if (cur.exists && curUpdated > doc.updatedAt) {
        return {
          ok: false,
          reason: 'conflict',
          current: {
            id: doc.id,
            updatedAt: curUpdated,
            deleted: curDeleted,
            doc: cur.get('doc') ?? null,
          },
        };
      }
      if (!cur.exists || curDeleted) {
        const live = await tx.get(this.col(uid).where('deleted', '==', false).count());
        if (live.data().count >= maxDocs) return { ok: false, reason: 'limit' };
      }
      if (cur.exists && !curDeleted && cur.get('doc') && curUpdated !== doc.updatedAt) {
        tx.set(ref.collection('versions').doc(), {
          savedAt: new Date().toISOString(),
          doc: cur.get('doc'),
        });
      }
      tx.set(ref, {
        updatedAt: doc.updatedAt,
        deleted: false,
        title: doc.title,
        doc,
        serverUpdatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, stored: { id: doc.id, updatedAt: doc.updatedAt, deleted: false, doc } };
    });
    if (result.ok) void this.trimVersions(uid, doc.id).catch(() => {});
    return result;
  }

  private async trimVersions(uid: string, id: string) {
    const snap = await this.col(uid)
      .doc(id)
      .collection('versions')
      .orderBy('savedAt', 'desc')
      .get();
    const extra = snap.docs.slice(MAX_VERSIONS);
    if (!extra.length) return;
    const batch = this.db.batch();
    extra.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  async deleteDoc(uid: string, id: string, at: string) {
    // Deleting removes the content, every kept version and its share links; only a tombstone
    // remains for sync.
    const versions = await this.col(uid).doc(id).collection('versions').listDocuments();
    const shares = await this.db.collection('shares').where('uid', '==', uid).get();
    const linked = shares.docs.filter((d) => d.get('docId') === id);
    if (versions.length || linked.length) {
      const batch = this.db.batch();
      versions.forEach((v) => batch.delete(v));
      linked.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await this.col(uid).doc(id).set({
      updatedAt: at,
      deleted: true,
      title: '',
      doc: null,
      serverUpdatedAt: FieldValue.serverTimestamp(),
    });
  }

  async listVersions(uid: string, id: string) {
    const snap = await this.col(uid)
      .doc(id)
      .collection('versions')
      .orderBy('savedAt', 'desc')
      .limit(MAX_VERSIONS)
      .get();
    return snap.docs.map((d) => ({
      savedAt: String(d.get('savedAt')),
      doc: d.get('doc') as ResumeDocument,
    }));
  }

  async getPass(uid: string) {
    const s = await this.db.collection('passes').doc(uid).get();
    return s.exists ? (s.data() as Pass) : null;
  }
  async setPass(uid: string, pass: Pass | null) {
    const ref = this.db.collection('passes').doc(uid);
    if (pass) await ref.set({ ...pass, uid });
    else await ref.delete();
  }
  private usageRef(uid: string, month: string) {
    return this.db.collection('usage').doc(`${uid}_${month}`);
  }
  async getUsage(uid: string, month: string) {
    const s = await this.usageRef(uid, month).get();
    const { uid: _u, month: _m, ...counts } = (s.data() ?? {}) as Record<string, unknown>;
    void _u;
    void _m;
    return counts as Record<string, number>;
  }
  async reserveUsage(uid: string, month: string, key: string, limit: number) {
    const ref = this.usageRef(uid, month);
    return this.db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      const n = Number(s.get(key) ?? 0);
      if (limit !== -1 && n >= limit) return false;
      tx.set(ref, { uid, month, [key]: n + 1 }, { merge: true });
      return true;
    });
  }
  async releaseUsage(uid: string, month: string, key: string) {
    await this.usageRef(uid, month).set({ [key]: FieldValue.increment(-1) }, { merge: true });
  }
  async getConfig(area: string) {
    const s = await this.db.collection('config').doc(area).get();
    return s.exists
      ? { version: Number(s.get('version')), value: s.get('value') as unknown }
      : null;
  }
  async saveConfig(area: string, value: unknown, by: string) {
    const ref = this.db.collection('config').doc(area);
    return this.db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      const version = Number(cur.get('version') ?? 0) + 1;
      const entry = { version, value, savedAt: new Date().toISOString(), savedBy: by };
      tx.set(ref, entry);
      tx.set(ref.collection('versions').doc(String(version).padStart(6, '0')), entry);
      return version;
    });
  }
  async listConfigVersions(area: string): Promise<ConfigVersion[]> {
    const snap = await this.db
      .collection('config')
      .doc(area)
      .collection('versions')
      .orderBy('version', 'desc')
      .limit(50)
      .get();
    return snap.docs.map((d) => d.data() as ConfigVersion);
  }

  async writeAudit(entry: Omit<AuditEntry, 'id'>) {
    await this.db.collection('adminAudit').add(entry);
  }
  async listAudit(limit: number): Promise<AuditEntry[]> {
    const snap = await this.db.collection('adminAudit').orderBy('at', 'desc').limit(limit).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, 'id'>) }));
  }
  async listPasses() {
    const snap = await this.db.collection('passes').orderBy('expiresAt', 'desc').limit(500).get();
    return snap.docs.map((d) => ({ ...(d.data() as Pass), uid: d.id }));
  }
  async usageTotals(month: string) {
    const snap = await this.db.collection('usage').where('month', '==', month).get();
    const out: Record<string, number> = {};
    for (const d of snap.docs)
      for (const [k, v] of Object.entries(d.data()))
        if (typeof v === 'number') out[k] = (out[k] ?? 0) + v;
    return out;
  }
  async createPaymentRequest(r: Omit<PaymentRequest, 'id'>) {
    const ref = await this.db.collection('paymentRequests').add(r);
    return { id: ref.id, ...r };
  }
  async listPaymentRequests(q: { uid?: string; status?: PaymentStatus; limit: number }) {
    // Equality filters without orderBy need no composite index; sort here (small sets).
    let query: FirebaseFirestore.Query = this.db.collection('paymentRequests');
    if (q.uid) query = query.where('uid', '==', q.uid);
    if (q.status) query = query.where('status', '==', q.status);
    const snap =
      q.uid || q.status
        ? await query.limit(500).get()
        : await query.orderBy('createdAt', 'desc').limit(q.limit).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRequest, 'id'>) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, q.limit);
  }
  async decidePaymentRequest(
    id: string,
    d: { status: 'approved' | 'rejected' | 'cancelled'; by: string; reason?: string },
  ) {
    const ref = this.db.collection('paymentRequests').doc(id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.get('status') !== 'pending') return null;
      const patch = {
        status: d.status,
        decidedBy: d.by,
        decidedAt: new Date().toISOString(),
        ...(d.reason ? { reason: d.reason } : {}),
      };
      tx.update(ref, patch);
      return { id, ...(snap.data() as Omit<PaymentRequest, 'id'>), ...patch };
    });
  }
  async userStats() {
    const users = this.db.collection('users');
    const [count, recent] = await Promise.all([
      users.where('studioV2', '==', true).count().get(),
      users.orderBy('lastSeenAt', 'desc').limit(50).get(),
    ]);
    return {
      total: count.data().count,
      recent: recent.docs.map((d) => ({
        uid: d.id,
        email: (d.get('email') as string | null) ?? null,
        lastSeenAt: d.get('lastSeenAt')?.toDate?.().toISOString?.() ?? null,
      })),
    };
  }
}
