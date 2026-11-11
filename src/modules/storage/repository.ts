import { safeParseResumeDocument, type ResumeDocument } from '@/modules/resume/schema';

/**
 * Storage boundary. Features talk to DocumentRepository only; Phase 6 adds a server
 * implementation behind the same interface (see docs/engineering/data-model.md).
 */
export type DocumentSummary = Pick<
  ResumeDocument,
  'id' | 'title' | 'updatedAt' | 'createdAt' | 'presetId'
> & {
  name: string;
  templateId: ResumeDocument['design']['templateId'];
};

export interface DocumentRepository {
  list(): DocumentSummary[];
  get(id: string): ResumeDocument | null;
  save(doc: ResumeDocument): void;
  remove(id: string): void;
  exportAll(): BackupFile;
  importAll(backup: unknown): { added: number; skipped: number };
}

export type BackupFile = {
  app: 'ai-cv-studio';
  version: 1;
  exportedAt: string;
  documents: ResumeDocument[];
};

const PREFIX = 'cvstudio:v1:doc:';
const QUARANTINE = 'cvstudio:v1:quarantine:';

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key'> & { readonly length: number };

export class BrowserDocumentRepository implements DocumentRepository {
  constructor(private readonly store: KV) {}

  private keys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.store.length; i++) {
      const k = this.store.key(i);
      if (k?.startsWith(PREFIX)) out.push(k);
    }
    return out;
  }

  get(id: string): ResumeDocument | null {
    const raw = this.store.getItem(PREFIX + id);
    if (!raw) return null;
    try {
      const parsed = safeParseResumeDocument(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      /* fall through */
    }
    // Never silently drop user data: move unreadable documents aside for recovery.
    this.store.setItem(QUARANTINE + id, raw);
    this.store.removeItem(PREFIX + id);
    return null;
  }

  list(): DocumentSummary[] {
    return this.keys()
      .map((k) => this.get(k.slice(PREFIX.length)))
      .filter((d): d is ResumeDocument => d !== null)
      .map((d) => ({
        id: d.id,
        title: d.title,
        updatedAt: d.updatedAt,
        createdAt: d.createdAt,
        presetId: d.presetId,
        name: d.basics.name,
        templateId: d.design.templateId,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  save(doc: ResumeDocument): void {
    this.store.setItem(PREFIX + doc.id, JSON.stringify(doc));
  }

  remove(id: string): void {
    this.store.removeItem(PREFIX + id);
  }

  exportAll(): BackupFile {
    const documents = this.keys()
      .map((k) => this.get(k.slice(PREFIX.length)))
      .filter((d): d is ResumeDocument => d !== null);
    return { app: 'ai-cv-studio', version: 1, exportedAt: new Date().toISOString(), documents };
  }

  importAll(backup: unknown): { added: number; skipped: number } {
    const docs = (backup as Partial<BackupFile> | null)?.documents;
    if ((backup as Partial<BackupFile> | null)?.app !== 'ai-cv-studio' || !Array.isArray(docs)) {
      throw new Error('This file is not an AI CV Studio backup.');
    }
    let added = 0;
    let skipped = 0;
    for (const raw of docs.slice(0, 200)) {
      const parsed = safeParseResumeDocument(raw);
      if (!parsed.success) {
        skipped++;
        continue;
      }
      let doc = parsed.data;
      // Never overwrite: an existing id gets a fresh copy instead.
      if (this.store.getItem(PREFIX + doc.id))
        doc = { ...doc, id: `${doc.id}-${Date.now().toString(36)}` };
      this.save(doc);
      added++;
    }
    return { added, skipped };
  }
}

/** In-memory KV for tests and for browsers where storage is unavailable. */
export class MemoryStore implements KV {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

let singleton: DocumentRepository | null = null;

/** The repository for this browser. Falls back to memory if storage is blocked. */
export function getRepository(): DocumentRepository {
  if (singleton) return singleton;
  let store: KV;
  try {
    window.localStorage.setItem('cvstudio:probe', '1');
    window.localStorage.removeItem('cvstudio:probe');
    store = window.localStorage;
  } catch {
    store = new MemoryStore();
  }
  singleton = new BrowserDocumentRepository(store);
  return singleton;
}
