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
}

export const MAX_VERSIONS = 10;
