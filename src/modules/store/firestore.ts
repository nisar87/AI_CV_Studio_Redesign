import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { ResumeDocument } from '@/modules/resume/schema';
import {
  MAX_VERSIONS,
  type DocSummary,
  type PutResult,
  type StoredDoc,
  type UserStore,
} from './types';

/**
 * Firestore layout (owned by the user, written only by the server):
 *   users/{uid}                              email, name, lastSeenAt (merged; old app fields untouched)
 *   users/{uid}/documents/{id}               { updatedAt, deleted, title, doc, serverUpdatedAt }
 *   users/{uid}/documents/{id}/versions/{v}  { savedAt, doc }   (last 10)
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
}
