import { describe, expect, it } from 'vitest';
import { driver, teacher } from '@/modules/resume/fixtures';
import type { ResumeDocument } from '@/modules/resume/schema';
import { BrowserDocumentRepository, MemoryStore } from '@/modules/storage/repository';
import { MemoryUserStore } from '@/modules/store/memory';
import { CloudSync, type SyncApi } from './sync';

/** A SyncApi backed by the real server-side memory store, as the API routes use it. */
function apiFor(store: MemoryUserStore, uid: string): SyncApi {
  return {
    list: () => store.listDocs(uid),
    get: async (id) => (await store.getDoc(uid, id))?.doc ?? null,
    async put(doc) {
      const r = await store.putDoc(uid, doc, 50);
      if (r.ok) return { status: 'ok' };
      return r.reason === 'conflict'
        ? { status: 'conflict', current: r.current.doc ?? undefined }
        : { status: 'limit' };
    },
    remove: (id, at) => store.deleteDoc(uid, id, at),
  };
}

const device = () => {
  const kv = new MemoryStore();
  return { kv, repo: new BrowserDocumentRepository(kv) };
};
const at = (d: ResumeDocument, iso: string, extra: Partial<ResumeDocument> = {}) => ({
  ...d,
  updatedAt: iso,
  ...extra,
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('cloud sync', () => {
  it('moves CVs made before signing in into the account, and shows them on another device', async () => {
    const server = new MemoryUserStore();
    const a = device();
    a.repo.save(at(driver, '2026-11-12T10:00:00.000Z'));
    const syncA = new CloudSync('u1', a.repo, apiFor(server, 'u1'), a.kv, 5);
    await syncA.start();
    expect((await server.listDocs('u1')).map((d) => d.id)).toEqual([driver.id]);

    const b = device();
    const syncB = new CloudSync('u1', b.repo, apiFor(server, 'u1'), b.kv, 5);
    await syncB.start();
    expect(b.repo.get(driver.id)?.basics.name).toBe('Imran Qureshi');
    syncA.stop();
    syncB.stop();
  });

  it('pushes edits after a short delay, and the newer edit wins on the other device', async () => {
    const server = new MemoryUserStore();
    const a = device();
    const b = device();
    const syncA = new CloudSync('u1', a.repo, apiFor(server, 'u1'), a.kv, 5);
    const syncB = new CloudSync('u1', b.repo, apiFor(server, 'u1'), b.kv, 5);
    a.repo.save(at(driver, '2026-11-12T10:00:00.000Z'));
    await syncA.start();
    await syncB.start();
    a.repo.save(at(driver, '2026-11-12T11:00:00.000Z', { title: 'Edited on A' }));
    await wait(30);
    expect((await server.getDoc('u1', driver.id))?.doc?.title).toBe('Edited on A');
    await syncB.fullSync();
    expect(b.repo.get(driver.id)?.title).toBe('Edited on A');
    syncA.stop();
    syncB.stop();
  });

  it('never loses an older offline edit: it becomes a copy next to the newer version', async () => {
    const server = new MemoryUserStore();
    await server.putDoc('u1', at(driver, '2026-11-12T12:00:00.000Z', { title: 'Newer' }), 50);
    const a = device();
    a.repo.save(at(driver, '2026-11-12T11:00:00.000Z', { title: 'Older offline edit' }));
    const sync = new CloudSync('u1', a.repo, apiFor(server, 'u1'), a.kv, 5);
    // Simulate an edit pushed while the server already had a newer one.
    await sync.push(driver.id);
    const titles = a.repo
      .list()
      .map((d) => d.title)
      .sort();
    expect(titles).toEqual(['Newer', 'Older offline edit (copy from this device)']);
    expect((await server.listDocs('u1')).filter((d) => !d.deleted)).toHaveLength(2);
  });

  it('deletions reach other devices; signing out removes only this account’s CVs from the device', async () => {
    const server = new MemoryUserStore();
    const a = device();
    a.repo.save(at(driver, '2026-01-01T10:00:00.000Z'));
    const syncA = new CloudSync('u1', a.repo, apiFor(server, 'u1'), a.kv, 5);
    await syncA.start();
    const b = device();
    const syncB = new CloudSync('u1', b.repo, apiFor(server, 'u1'), b.kv, 5);
    await syncB.start();
    a.repo.remove(driver.id);
    await wait(20);
    await syncB.fullSync();
    expect(b.repo.get(driver.id)).toBeNull();

    // Device B: one account CV and one CV belonging to nobody (made by someone else signed out).
    b.repo.save(at(teacher, '2026-01-01T10:00:00.000Z'));
    await wait(20);
    syncB.stop();
    const strangers = device();
    strangers.repo.save(at(driver, '2026-01-01T10:00:00.000Z', { id: 'local-only' }));
    await syncB.signOutCleanup();
    expect(b.repo.get(teacher.id)).toBeNull();
    expect(strangers.repo.get('local-only')).not.toBeNull();
    syncA.stop();
  });
});
