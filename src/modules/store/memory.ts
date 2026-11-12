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
    this.users.delete(uid);
    this.users.set(uid, info);
    this.seen?.set(uid, new Date().toISOString());
  }

  private metrics = new Map<string, Record<string, number>>();
  async bumpMetrics(day: string, counts: Record<string, number>) {
    const m = this.metrics.get(day) ?? {};
    for (const [k, v] of Object.entries(counts)) m[k] = (m[k] ?? 0) + v;
    this.metrics.set(day, m);
  }
  async getMetrics(from: string, to: string) {
    return [...this.metrics.entries()]
      .filter(([d]) => d >= from && d <= to)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, counts]) => ({ day, counts: { ...counts } }));
  }
  async findPaymentByReference(referenceKey: string) {
    const p = this.payments.find((x) => x.referenceKey === referenceKey && x.status !== 'rejected');
    return p ? structuredClone(p) : null;
  }

  async deleteUserData(uid: string) {
    this.users.delete(uid);
    this.seen.delete(uid);
    this.docs.delete(uid);
    for (const k of [...this.versions.keys()]) if (k.startsWith(`${uid}/`)) this.versions.delete(k);
    this.passes.delete(uid);
    for (const k of [...this.usage.keys()]) if (k.startsWith(`${uid}/`)) this.usage.delete(k);
    for (const p of this.payments) if (p.uid === uid) p.email = null;
  }

  async knownUser(uid: string) {
    return this.users.has(uid);
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
    this.versions.delete(`${uid}/${id}`);
  }

  async listVersions(uid: string, id: string) {
    return structuredClone(this.versions.get(`${uid}/${id}`) ?? []);
  }

  private passes = new Map<string, Pass>();
  private usage = new Map<string, Record<string, number>>();
  private config = new Map<string, ConfigVersion[]>();

  async getPass(uid: string) {
    return this.passes.get(uid) ?? null;
  }
  async setPass(uid: string, pass: Pass | null) {
    if (pass) this.passes.set(uid, pass);
    else this.passes.delete(uid);
  }
  async getUsage(uid: string, month: string) {
    return { ...(this.usage.get(`${uid}/${month}`) ?? {}) };
  }
  async reserveUsage(uid: string, month: string, key: string, limit: number) {
    const k = `${uid}/${month}`;
    const u = this.usage.get(k) ?? {};
    const n = u[key] ?? 0;
    if (limit !== -1 && n >= limit) return false;
    this.usage.set(k, { ...u, [key]: n + 1 });
    return true;
  }
  async releaseUsage(uid: string, month: string, key: string) {
    const k = `${uid}/${month}`;
    const u = this.usage.get(k) ?? {};
    this.usage.set(k, { ...u, [key]: Math.max(0, (u[key] ?? 0) - 1) });
  }
  async getConfig(area: string) {
    const v = this.config.get(area)?.[0];
    return v ? { version: v.version, value: structuredClone(v.value) } : null;
  }
  async saveConfig(area: string, value: unknown, by: string) {
    const list = this.config.get(area) ?? [];
    const version = (list[0]?.version ?? 0) + 1;
    list.unshift({
      version,
      savedAt: new Date().toISOString(),
      savedBy: by,
      value: structuredClone(value),
    });
    this.config.set(area, list.slice(0, 50));
    return version;
  }
  async listConfigVersions(area: string) {
    return structuredClone(this.config.get(area) ?? []);
  }

  private audit: AuditEntry[] = [];
  private seen = new Map<string, string>();

  async writeAudit(entry: Omit<AuditEntry, 'id'>) {
    this.audit.unshift({ id: String(this.audit.length + 1), ...structuredClone(entry) });
  }
  async listAudit(limit: number) {
    return structuredClone(this.audit.slice(0, limit));
  }
  async listPasses() {
    return [...this.passes.entries()].map(([uid, p]) => ({ ...p, uid }));
  }
  async usageTotals(month: string) {
    const out: Record<string, number> = {};
    for (const [k, v] of this.usage)
      if (k.endsWith(`/${month}`))
        for (const [c, n] of Object.entries(v)) out[c] = (out[c] ?? 0) + n;
    return out;
  }
  private payments: PaymentRequest[] = [];
  async createPaymentRequest(r: Omit<PaymentRequest, 'id'>) {
    const saved = { id: `pr${this.payments.length + 1}`, ...structuredClone(r) };
    this.payments.unshift(saved);
    return structuredClone(saved);
  }
  async listPaymentRequests(q: { uid?: string; status?: PaymentStatus; limit: number }) {
    return structuredClone(
      this.payments
        .filter((p) => (!q.uid || p.uid === q.uid) && (!q.status || p.status === q.status))
        .slice(0, q.limit),
    );
  }
  async decidePaymentRequest(
    id: string,
    d: { status: 'approved' | 'rejected'; by: string; reason?: string },
  ) {
    const p = this.payments.find((x) => x.id === id);
    if (!p || p.status !== 'pending') return null;
    Object.assign(p, {
      status: d.status,
      decidedBy: d.by,
      decidedAt: new Date().toISOString(),
      ...(d.reason ? { reason: d.reason } : {}),
    });
    return structuredClone(p);
  }
  async userStats() {
    const recent = [...this.users.entries()].map(([uid, u]) => ({
      uid,
      email: u.email,
      lastSeenAt: this.seen.get(uid) ?? null,
    }));
    return { total: this.users.size, recent: recent.reverse().slice(0, 50) };
  }
}
