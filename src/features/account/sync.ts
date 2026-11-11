'use client';

import type { ResumeDocument } from '@/modules/resume/schema';
import { safeParseResumeDocument } from '@/modules/resume/schema';
import type { DocumentRepository } from '@/modules/storage/repository';

/**
 * Cloud sync (docs/product/studio-master-plan.md §4.1). Editing stays local and instant; while
 * signed in, every local save is pushed to the account, and on sign-in the account and this
 * device are merged:
 *   - documents only on this device (e.g. made before signing in) move into the account;
 *   - the newer edit wins; the replaced one is kept server-side as a version;
 *   - deletions propagate (tombstones).
 * Which local documents belong to the signed-in account is remembered, so signing out removes
 * them from a shared computer while leaving anything else untouched.
 */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

type Remote = { id: string; updatedAt: string; deleted: boolean };
const mapKey = (uid: string) => `cvstudio:v1:sync:${uid}`;

export class CloudSync {
  private applyingRemote = false;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<(s: SyncState) => void>();
  state: SyncState = 'idle';

  constructor(
    private readonly uid: string,
    private readonly repo: DocumentRepository,
    private readonly api = defaultApi,
    private readonly storage: Pick<
      Storage,
      'getItem' | 'setItem' | 'removeItem'
    > = globalThis.localStorage,
    private readonly delayMs = 1200,
  ) {}

  onState(l: (s: SyncState) => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private set(state: SyncState) {
    this.state = state;
    this.listeners.forEach((l) => l(state));
  }

  private owned(): Set<string> {
    try {
      return new Set(JSON.parse(this.storage.getItem(mapKey(this.uid)) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  }
  private setOwned(ids: Set<string>) {
    try {
      this.storage.setItem(mapKey(this.uid), JSON.stringify([...ids]));
    } catch {
      /* storage full: sync still works, sign-out cleanup may miss some ids */
    }
  }

  private local(id: string) {
    return this.repo.get(id);
  }
  private writeLocal(doc: ResumeDocument) {
    this.applyingRemote = true;
    try {
      this.repo.save(doc);
    } finally {
      this.applyingRemote = false;
    }
  }
  private removeLocal(id: string) {
    this.applyingRemote = true;
    try {
      this.repo.remove(id);
    } finally {
      this.applyingRemote = false;
    }
  }

  /** Merge account and device, then keep pushing local changes. */
  async start() {
    this.unsubscribe = this.repo.subscribe((e) => {
      if (this.applyingRemote) return;
      if (e.type === 'save') this.schedulePush(e.id);
      else void this.pushDelete(e.id);
    });
    await this.fullSync();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.timers.forEach((t) => globalThis.clearTimeout(t));
    this.timers.clear();
  }

  async fullSync() {
    this.set('syncing');
    try {
      const remote = await this.api.list();
      const owned = this.owned();
      const byId = new Map(remote.map((r) => [r.id, r]));
      // Remote → device
      for (const r of remote) {
        const local = this.local(r.id);
        if (r.deleted) {
          if (local && local.updatedAt <= r.updatedAt) this.removeLocal(r.id);
          owned.delete(r.id);
          continue;
        }
        if (!local || local.updatedAt < r.updatedAt) {
          const doc = await this.api.get(r.id);
          if (doc) this.writeLocal(doc);
        }
        owned.add(r.id);
      }
      // Device → account (including documents made before signing in)
      for (const s of this.repo.list()) {
        const r = byId.get(s.id);
        if (r?.deleted && s.updatedAt <= r.updatedAt) continue;
        if (!r || s.updatedAt > r.updatedAt) {
          await this.push(s.id);
        }
        owned.add(s.id);
      }
      this.setOwned(owned);
      this.set('synced');
    } catch (e) {
      this.set(isOffline(e) ? 'offline' : 'error');
    }
  }

  private schedulePush(id: string) {
    const t = this.timers.get(id);
    if (t) globalThis.clearTimeout(t);
    this.set('syncing');
    this.timers.set(
      id,
      globalThis.setTimeout(() => {
        this.timers.delete(id);
        void this.push(id).then(
          () => this.timers.size === 0 && this.set('synced'),
          (e) => this.set(isOffline(e) ? 'offline' : 'error'),
        );
      }, this.delayMs),
    );
  }

  /** Push one local document; on conflict keep the newer account copy and save ours as a copy. */
  async push(id: string) {
    const doc = this.local(id);
    if (!doc) return;
    const r = await this.api.put(doc);
    if (r.status === 'ok') {
      const owned = this.owned();
      owned.add(id);
      this.setOwned(owned);
    } else if (r.status === 'conflict' && r.current) {
      const copy: ResumeDocument = {
        ...doc,
        id: `${doc.id}-${Date.now().toString(36)}`,
        title: `${doc.title} (copy from this device)`,
      };
      this.writeLocal(r.current);
      this.writeLocal(copy);
      await this.push(copy.id);
    }
  }

  async pushDelete(id: string) {
    await this.api.remove(id, new Date().toISOString()).catch(() => {});
    const owned = this.owned();
    owned.delete(id);
    this.setOwned(owned);
  }

  /** Signing out: flush pending saves, then remove this account's documents from the device. */
  async signOutCleanup() {
    const pending = [...this.timers.keys()];
    this.stop();
    for (const id of pending) await this.push(id).catch(() => {});
    for (const id of this.owned()) this.removeLocal(id);
    this.storage.removeItem(mapKey(this.uid));
  }
}

function isOffline(e: unknown) {
  return typeof navigator !== 'undefined' && !navigator.onLine
    ? true
    : (e as Error)?.name === 'TypeError';
}

export type SyncApi = {
  list(): Promise<Remote[]>;
  get(id: string): Promise<ResumeDocument | null>;
  put(
    doc: ResumeDocument,
  ): Promise<{ status: 'ok' | 'conflict' | 'limit' | 'error'; current?: ResumeDocument }>;
  remove(id: string, at: string): Promise<void>;
};

export const defaultApi: SyncApi = {
  async list() {
    const r = await fetch('/api/documents', { cache: 'no-store' });
    if (!r.ok) throw new Error(`list ${r.status}`);
    return ((await r.json()) as { documents: Remote[] }).documents;
  },
  async get(id) {
    const r = await fetch(`/api/documents/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { doc: unknown };
    const p = safeParseResumeDocument(j.doc);
    return p.success ? p.data : null;
  },
  async put(doc) {
    const r = await fetch(`/api/documents/${encodeURIComponent(doc.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document: doc }),
    });
    if (r.ok) return { status: 'ok' };
    if (r.status === 409) {
      const j = (await r.json()) as { current?: { doc?: unknown } };
      const p = safeParseResumeDocument(j.current?.doc);
      return { status: 'conflict', current: p.success ? p.data : undefined };
    }
    if (r.status === 402) return { status: 'limit' };
    throw new Error(`put ${r.status}`);
  },
  async remove(id, at) {
    await fetch(`/api/documents/${encodeURIComponent(id)}?at=${encodeURIComponent(at)}`, {
      method: 'DELETE',
    });
  },
};
