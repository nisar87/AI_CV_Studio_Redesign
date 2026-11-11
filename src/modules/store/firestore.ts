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
} from './types';

/**
 * Firestore layout (owned by the user, written only by the server):
 *   users/{uid}                              email, name, lastSeenAt (merged; old app fields untouched)
 *   users/{uid}/documents/{id}               { updatedAt, deleted, title, doc, serverUpdatedAt }
 *   users/{uid}/documents/{id}/versions/{v}  { savedAt, doc }   (last 10)
 *   users/{uid}/billing/pass                 Pass (Premium access until expiresAt)
 *   users/{uid}/usage/{yyyy-mm}              { 'pdf.download': n, ... }
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
    const s = await this.db.collection('users').doc(uid).collection('billing').doc('pass').get();
    return s.exists ? (s.data() as Pass) : null;
  }
  async setPass(uid: string, pass: Pass | null) {
    const ref = this.db.collection('users').doc(uid).collection('billing').doc('pass');
    if (pass) await ref.set(pass);
    else await ref.delete();
  }
  private usageRef(uid: string, month: string) {
    return this.db.collection('users').doc(uid).collection('usage').doc(month);
  }
  async getUsage(uid: string, month: string) {
    const s = await this.usageRef(uid, month).get();
    return (s.data() as Record<string, number> | undefined) ?? {};
  }
  async reserveUsage(uid: string, month: string, key: string, limit: number) {
    const ref = this.usageRef(uid, month);
    return this.db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      const n = Number(s.get(key) ?? 0);
      if (limit !== -1 && n >= limit) return false;
      tx.set(ref, { [key]: n + 1 }, { merge: true });
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
}
