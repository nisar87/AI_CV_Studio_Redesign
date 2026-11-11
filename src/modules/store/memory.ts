import type { ResumeDocument } from '@/modules/resume/schema';
import {
  MAX_VERSIONS,
  type DocSummary,
  type PutResult,
  type StoredDoc,
  type UserStore,
} from './types';

/** In-memory store for development and tests (one per server process). */
export class MemoryUserStore implements UserStore {
  private users = new Map<string, { email: string | null; name: string | null }>();
  private docs = new Map<string, Map<string, StoredDoc>>();
  private versions = new Map<string, { savedAt: string; doc: ResumeDocument }[]>();

  private bucket(uid: string) {
    let b = this.docs.get(uid);
    if (!b) this.docs.set(uid, (b = new Map()));
    return b;
  }

  async touchUser(uid: string, info: { email: string | null; name: string | null }) {
    this.users.set(uid, info);
  }

  async listDocs(uid: string): Promise<DocSummary[]> {
    return [...this.bucket(uid).values()].map((d) => ({
      id: d.id,
      updatedAt: d.updatedAt,
      deleted: d.deleted,
      title: d.doc?.title ?? '',
    }));
  }

  async getDoc(uid: string, id: string) {
    const d = this.bucket(uid).get(id);
    return d ? structuredClone(d) : null;
  }

  async putDoc(uid: string, doc: ResumeDocument, maxDocs: number): Promise<PutResult> {
    const b = this.bucket(uid);
    const cur = b.get(doc.id);
    if (cur && cur.updatedAt > doc.updatedAt)
      return { ok: false, reason: 'conflict', current: structuredClone(cur) };
    if (!cur || cur.deleted) {
      const live = [...b.values()].filter((d) => !d.deleted).length;
      if (live >= maxDocs) return { ok: false, reason: 'limit' };
    }
    if (cur?.doc && !cur.deleted && cur.updatedAt !== doc.updatedAt) {
      const key = `${uid}/${doc.id}`;
      const list = this.versions.get(key) ?? [];
      list.unshift({ savedAt: new Date().toISOString(), doc: cur.doc });
      this.versions.set(key, list.slice(0, MAX_VERSIONS));
    }
    const stored: StoredDoc = {
      id: doc.id,
      updatedAt: doc.updatedAt,
      deleted: false,
      doc: structuredClone(doc),
    };
    b.set(doc.id, stored);
    return { ok: true, stored };
  }

  async deleteDoc(uid: string, id: string, at: string) {
    this.bucket(uid).set(id, { id, updatedAt: at, deleted: true, doc: null });
  }

  async listVersions(uid: string, id: string) {
    return structuredClone(this.versions.get(`${uid}/${id}`) ?? []);
  }
}
