import type { Job } from '@/modules/jobs/schema';
import type { SavedLetter } from '@/modules/letters/schema';
import type { Story } from '@/modules/stories/schema';
import type { SkillPlan } from '@/modules/skills/gap';
import type { CoachThread } from '@/modules/coach/thread';
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
  type Share,
  type Portfolio,
  SavedDesign,
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

  private jobs = new Map<string, Map<string, Job>>();
  private jobBucket(uid: string) {
    let b = this.jobs.get(uid);
    if (!b) this.jobs.set(uid, (b = new Map()));
    return b;
  }
  async listJobs(uid: string) {
    return structuredClone([...this.jobBucket(uid).values()]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  async getJob(uid: string, id: string) {
    const j = this.jobBucket(uid).get(id);
    return j ? structuredClone(j) : null;
  }
  async putJob(uid: string, job: Job) {
    this.jobBucket(uid).set(job.id, structuredClone(job));
  }
  async deleteJob(uid: string, id: string) {
    this.jobBucket(uid).delete(id);
  }

  private coach = new Map<string, CoachThread>();
  async getCoachThread(uid: string) {
    const t = this.coach.get(uid);
    return t ? structuredClone(t) : null;
  }
  async putCoachThread(uid: string, t: CoachThread) {
    this.coach.set(uid, structuredClone(t));
  }
  async deleteCoachThread(uid: string) {
    this.coach.delete(uid);
  }

  private letters = new Map<string, Map<string, SavedLetter>>();
  private letterBucket(uid: string) {
    let b = this.letters.get(uid);
    if (!b) this.letters.set(uid, (b = new Map()));
    return b;
  }
  async listLetters(uid: string) {
    return structuredClone([...this.letterBucket(uid).values()]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  async getLetter(uid: string, id: string) {
    const l = this.letterBucket(uid).get(id);
    return l ? structuredClone(l) : null;
  }
  async putLetter(uid: string, letter: SavedLetter) {
    this.letterBucket(uid).set(letter.id, structuredClone(letter));
  }
  async deleteLetter(uid: string, id: string) {
    this.letterBucket(uid).delete(id);
  }

  private stories = new Map<string, Map<string, Story>>();
  private storyBucket(uid: string) {
    let b = this.stories.get(uid);
    if (!b) this.stories.set(uid, (b = new Map()));
    return b;
  }
  async listStories(uid: string) {
    return structuredClone([...this.storyBucket(uid).values()]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  async getStory(uid: string, id: string) {
    const s = this.storyBucket(uid).get(id);
    return s ? structuredClone(s) : null;
  }
  async putStory(uid: string, story: Story) {
    this.storyBucket(uid).set(story.id, structuredClone(story));
  }
  async deleteStory(uid: string, id: string) {
    this.storyBucket(uid).delete(id);
  }

  private skillPlans = new Map<string, Map<string, SkillPlan>>();
  private planBucket(uid: string) {
    let b = this.skillPlans.get(uid);
    if (!b) this.skillPlans.set(uid, (b = new Map()));
    return b;
  }
  async listSkillPlans(uid: string) {
    return structuredClone([...this.planBucket(uid).values()]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  async getSkillPlan(uid: string, id: string) {
    const p = this.planBucket(uid).get(id);
    return p ? structuredClone(p) : null;
  }
  async putSkillPlan(uid: string, plan: SkillPlan) {
    this.planBucket(uid).set(plan.id, structuredClone(plan));
  }
  async deleteSkillPlan(uid: string, id: string) {
    this.planBucket(uid).delete(id);
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
    this.jobs.delete(uid);
    this.letters.delete(uid);
    this.stories.delete(uid);
    this.skillPlans.delete(uid);
    this.coach.delete(uid);
    this.designs.delete(uid);
    for (const [t, sh] of this.shares) if (sh.uid === uid) this.shares.delete(t);
    for (const [k, v] of this.portfolios) if (v.uid === uid) this.portfolios.delete(k);
    for (const [c, u] of this.referralCodes) if (u === uid) this.referralCodes.delete(c);
    this.referredBy.delete(uid);
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
    for (const [t, sh] of this.shares) if (sh.uid === uid && sh.docId === id) this.shares.delete(t);
  }

  private referralCodes = new Map<string, string>(); // code → uid
  private referredBy = new Map<string, string>();
  async countCouponUses(code: string) {
    return this.payments.filter(
      (p) => p.couponCode === code && (p.status === 'pending' || p.status === 'approved'),
    ).length;
  }
  async referralCodeOf(uid: string, make: () => string) {
    for (const [c, u] of this.referralCodes) if (u === uid) return c;
    let code = make();
    while (this.referralCodes.has(code)) code = make();
    this.referralCodes.set(code, uid);
    return code;
  }
  async referralOwner(code: string) {
    return this.referralCodes.get(code) ?? null;
  }
  async setReferredBy(uid: string, referrerUid: string) {
    if (uid !== referrerUid && !this.referredBy.has(uid)) this.referredBy.set(uid, referrerUid);
  }
  async getReferredBy(uid: string) {
    return this.referredBy.get(uid) ?? null;
  }
  async countReferred(uid: string) {
    return [...this.referredBy.values()].filter((r) => r === uid).length;
  }

  private portfolios = new Map<string, Portfolio>();
  async getPortfolio(slug: string) {
    const p = this.portfolios.get(slug);
    return p ? structuredClone(p) : null;
  }
  async getPortfolioOf(uid: string) {
    const p = [...this.portfolios.values()].find((x) => x.uid === uid);
    return p ? structuredClone(p) : null;
  }
  async putPortfolio(p: Portfolio) {
    const taken = this.portfolios.get(p.slug);
    if (taken && taken.uid !== p.uid) return false;
    for (const [k, v] of this.portfolios) if (v.uid === p.uid) this.portfolios.delete(k);
    this.portfolios.set(p.slug, structuredClone(p));
    return true;
  }
  async deletePortfolioOf(uid: string) {
    for (const [k, v] of this.portfolios) if (v.uid === uid) this.portfolios.delete(k);
  }
  async bumpPortfolioViews(slug: string) {
    const p = this.portfolios.get(slug);
    if (p) {
      p.views += 1;
      const day = new Date().toISOString().slice(0, 10);
      p.daily = { ...p.daily, [day]: (p.daily?.[day] ?? 0) + 1 };
    }
  }

  private designs = new Map<string, SavedDesign[]>();
  async listDesigns(uid: string) {
    return structuredClone(this.designs.get(uid) ?? []);
  }
  async putDesign(d: SavedDesign) {
    const list = (this.designs.get(d.uid) ?? []).filter((x) => x.id !== d.id);
    this.designs.set(d.uid, [structuredClone(d), ...list]);
  }
  async deleteDesign(uid: string, id: string) {
    const list = this.designs.get(uid) ?? [];
    this.designs.set(
      uid,
      list.filter((x) => x.id !== id),
    );
    return list.some((x) => x.id === id);
  }
  private shares = new Map<string, Share>();
  async createShare(share: Share) {
    this.shares.set(share.token, structuredClone(share));
  }
  async getShare(token: string) {
    const s = this.shares.get(token);
    return s ? structuredClone(s) : null;
  }
  async listShares(uid: string) {
    return [...this.shares.values()].filter((s) => s.uid === uid).map((s) => structuredClone(s));
  }
  async updateShare(token: string, patch: Partial<Pick<Share, 'enabled'>>) {
    const s = this.shares.get(token);
    if (s) this.shares.set(token, { ...s, ...patch });
  }
  async deleteShare(token: string) {
    this.shares.delete(token);
  }
  async bumpShareViews(token: string, at: string) {
    const s = this.shares.get(token);
    if (s) {
      const day = at.slice(0, 10);
      this.shares.set(token, {
        ...s,
        views: s.views + 1,
        lastViewedAt: at,
        daily: { ...s.daily, [day]: (s.daily?.[day] ?? 0) + 1 },
      });
    }
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
  async reserveUsage(uid: string, month: string, key: string, limit: number, weight = 1) {
    const k = `${uid}/${month}`;
    const u = this.usage.get(k) ?? {};
    const n = u[key] ?? 0;
    if (limit !== -1 && n + weight > limit) return false;
    this.usage.set(k, { ...u, [key]: n + weight });
    return true;
  }
  async releaseUsage(uid: string, month: string, key: string, weight = 1) {
    const k = `${uid}/${month}`;
    const u = this.usage.get(k) ?? {};
    this.usage.set(k, { ...u, [key]: Math.max(0, (u[key] ?? 0) - weight) });
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
    d: { status: 'approved' | 'rejected' | 'cancelled'; by: string; reason?: string },
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
