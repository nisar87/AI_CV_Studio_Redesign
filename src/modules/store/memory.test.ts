import { describe, expect, it } from 'vitest';
import { driver } from '@/modules/resume/fixtures';
import { MemoryUserStore } from './memory';

const at = (iso: string) => ({ ...driver, updatedAt: iso });

describe('user document store (memory)', () => {
  it('saves, lists and returns documents per user', async () => {
    const s = new MemoryUserStore();
    expect((await s.putDoc('u1', at('2026-11-12T10:00:00.000Z'), 5)).ok).toBe(true);
    expect(await s.listDocs('u1')).toEqual([
      { id: driver.id, updatedAt: '2026-11-12T10:00:00.000Z', deleted: false, title: driver.title },
    ]);
    expect(await s.listDocs('u2')).toEqual([]);
    expect((await s.getDoc('u1', driver.id))?.doc?.basics.name).toBe('Imran Qureshi');
  });

  it('rejects an older edit with the newer copy, and keeps replaced versions', async () => {
    const s = new MemoryUserStore();
    await s.putDoc('u1', at('2026-11-12T10:00:00.000Z'), 5);
    await s.putDoc('u1', { ...at('2026-11-12T11:00:00.000Z'), title: 'Second' }, 5);
    const stale = await s.putDoc('u1', at('2026-11-12T10:30:00.000Z'), 5);
    expect(stale).toMatchObject({
      ok: false,
      reason: 'conflict',
      current: { updatedAt: '2026-11-12T11:00:00.000Z' },
    });
    const versions = await s.listVersions('u1', driver.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.doc.updatedAt).toBe('2026-11-12T10:00:00.000Z');
  });

  it('enforces the per-user cap on new documents only, and keeps deletions as tombstones', async () => {
    const s = new MemoryUserStore();
    await s.putDoc('u1', at('2026-11-12T10:00:00.000Z'), 1);
    expect(await s.putDoc('u1', { ...at('2026-11-12T10:00:00.000Z'), id: 'other' }, 1)).toEqual({
      ok: false,
      reason: 'limit',
    });
    expect((await s.putDoc('u1', at('2026-11-12T12:00:00.000Z'), 1)).ok).toBe(true);
    await s.deleteDoc('u1', driver.id, '2026-11-12T13:00:00.000Z');
    expect(await s.listDocs('u1')).toMatchObject([{ id: driver.id, deleted: true }]);
    expect((await s.putDoc('u1', { ...at('2026-11-12T14:00:00.000Z'), id: 'other' }, 1)).ok).toBe(
      true,
    );
  });
});

describe('payment requests', () => {
  const base = {
    uid: 'u1',
    email: 'a@example.com',
    passId: 'month',
    passLabel: '1 month',
    days: 30,
    pricePkr: 499,
    methodId: 'bank',
    methodLabel: 'Bank transfer',
    reference: 'TID1',
    status: 'pending' as const,
    createdAt: '2026-11-12T10:00:00.000Z',
  };

  it('lists newest first and filters by owner and status', async () => {
    const s = new MemoryUserStore();
    await s.createPaymentRequest(base);
    await s.createPaymentRequest({ ...base, uid: 'u2', createdAt: '2026-11-12T11:00:00.000Z' });
    expect((await s.listPaymentRequests({ limit: 10 })).map((r) => r.uid)).toEqual(['u2', 'u1']);
    expect(await s.listPaymentRequests({ uid: 'u1', limit: 10 })).toHaveLength(1);
    expect(await s.listPaymentRequests({ status: 'approved', limit: 10 })).toHaveLength(0);
  });

  it('decides a request only once', async () => {
    const s = new MemoryUserStore();
    const r = await s.createPaymentRequest(base);
    const first = await s.decidePaymentRequest(r.id, { status: 'approved', by: 'admin' });
    expect(first).toMatchObject({ status: 'approved', decidedBy: 'admin' });
    expect(await s.decidePaymentRequest(r.id, { status: 'rejected', by: 'other' })).toBeNull();
    expect(await s.decidePaymentRequest('missing', { status: 'approved', by: 'x' })).toBeNull();
  });
});
