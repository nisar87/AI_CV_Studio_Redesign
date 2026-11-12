import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
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
} from './types';

/**
 * Firestore layout (owned by the user, written only by the server):
 *   users/{uid}                              email, name, lastSeenAt (merged; old app fields untouched)
 *   users/{uid}/documents/{id}               { updatedAt, deleted, title, doc, serverUpdatedAt }
 *   users/{uid}/documents/{id}/versions/{v}  { savedAt, doc }   (last 10)
 *   passes/{uid}                             Pass (Premium access until expiresAt) + uid, email
 *   usage/{uid}_{yyyy-mm}                    { uid, month, 'pdf.download': n, ... }
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
    d: { status: 'approved' | 'rejected'; by: string; reason?: string },
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
