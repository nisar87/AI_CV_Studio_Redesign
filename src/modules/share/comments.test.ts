import { describe, expect, it } from 'vitest';
import { commentEmail } from '@/modules/notify/server';
import { driver } from '@/modules/resume/fixtures';
import type { ResumeDocument } from '@/modules/resume/schema';
import { MemoryUserStore } from '@/modules/store/memory';
import {
  checkQuote,
  checkRef,
  commentInput,
  commentTargets,
  ownerComment,
  reviewerComment,
  targetLabel,
  type ShareComment,
} from './comments';

const doc = structuredClone(driver) as ResumeDocument;
const exp = doc.sections.find((s) => s.kind === 'experience')!;
const job = exp.items[0] as { id: string; role: string; bullets: string[] };
const KEY = 'a'.repeat(32);

describe('share comments: where a comment points', () => {
  it('keeps refs that are on the CV and drops the rest', () => {
    expect(checkRef(doc, '')).toBe('');
    expect(checkRef(doc, 'basics')).toBe('basics');
    expect(checkRef(doc, 'basics/summary')).toBe('basics/summary');
    expect(checkRef(doc, 'basics/contact')).toBe('basics/contact');
    expect(checkRef(doc, 'basics/password')).toBe('');
    expect(checkRef(doc, exp.id)).toBe(exp.id);
    expect(checkRef(doc, `${exp.id}/${job.id}`)).toBe(`${exp.id}/${job.id}`);
    expect(checkRef(doc, `${exp.id}/nope`)).toBe('');
    expect(checkRef(doc, `nope/${job.id}`)).toBe('');
    expect(checkRef(doc, `${exp.id}/${job.id}/x`)).toBe('');
  });

  it('never points at a hidden section', () => {
    const d = structuredClone(doc);
    d.sections.find((s) => s.id === exp.id)!.hidden = true;
    expect(checkRef(d, exp.id)).toBe('');
    expect(checkRef(d, `${exp.id}/${job.id}`)).toBe('');
  });

  it('keeps a quote only when the words are on the CV', () => {
    const bullet = job.bullets[0]!;
    expect(checkQuote(doc, `  ${bullet.toUpperCase()}  `)).toBe(bullet.toUpperCase());
    expect(checkQuote(doc, 'Was fired for being late')).toBe('');
    expect(checkQuote(doc, 'a')).toBe('');
    // Words from a hidden section are not on the CV people see.
    const d = structuredClone(doc);
    d.sections.find((s) => s.id === exp.id)!.hidden = true;
    expect(checkQuote(d, bullet)).toBe('');
  });

  it('shortens a long quote', () => {
    const d = structuredClone(doc);
    d.basics.summary = 'word '.repeat(120).trim();
    const q = checkQuote(d, d.basics.summary);
    expect(q.length).toBeLessThanOrEqual(300);
    expect(q.endsWith('…')).toBe(true);
  });

  it('lists the parts of the CV to choose from, with readable labels', () => {
    const t = commentTargets(doc);
    expect(t[0]).toEqual({ ref: '', label: 'The whole CV' });
    expect(t.some((x) => x.ref === 'basics')).toBe(true);
    const jobTarget = t.find((x) => x.ref === `${exp.id}/${job.id}`);
    expect(jobTarget?.label).toContain(job.role);
    expect(jobTarget?.label.startsWith(exp.title)).toBe(true);
    expect(new Set(t.map((x) => x.ref)).size).toBe(t.length);
  });

  it('labels where a comment is, even after that part is removed', () => {
    expect(targetLabel(doc, '')).toBe('The whole CV');
    expect(targetLabel(doc, 'basics/contact')).toBe('Name and contact details');
    expect(targetLabel(doc, 'basics/summary')).toBe('Profile');
    expect(targetLabel(doc, `${exp.id}/gone`)).toBe('A part that was removed');
    expect(targetLabel(null, `${exp.id}/${job.id}`)).toBe('Part of the CV');
  });
});

describe('share comments: what a reviewer may send', () => {
  const ok = { ref: '', quote: '', text: 'Lead with the result.', author: 'Sara', key: KEY };

  it('accepts a normal comment and cleans it', () => {
    const r = commentInput.parse({
      ...ok,
      text: '  Line one\r\n\r\n\r\n\r\nLine two‮  ',
      author: '  Sara   K​ ',
    });
    expect(r.text).toBe('Line one\n\nLine two');
    expect(r.author).toBe('Sara K');
  });

  it('needs a comment, a name and a valid browser key', () => {
    expect(commentInput.safeParse({ ...ok, text: '   ' }).success).toBe(false);
    expect(commentInput.safeParse({ ...ok, author: '' }).success).toBe(false);
    expect(commentInput.safeParse({ ...ok, author: 'x'.repeat(61) }).success).toBe(false);
    expect(commentInput.safeParse({ ...ok, text: 'x'.repeat(1001) }).success).toBe(false);
    expect(commentInput.safeParse({ ...ok, key: 'short' }).success).toBe(false);
    expect(commentInput.safeParse({ ...ok, key: `${KEY}/../` }).success).toBe(false);
  });
});

const comment = (o: Partial<ShareComment> = {}): ShareComment => ({
  id: 'c1',
  docId: doc.id,
  token: 't'.repeat(22),
  ref: `${exp.id}/${job.id}`,
  quote: job.bullets[0]!,
  text: 'Lead with the result.',
  author: 'Sara',
  keyHash: 'secret-hash',
  createdAt: '2026-11-14T08:00:00.000Z',
  status: 'open',
  ...o,
});

describe('share comments: what each side sees', () => {
  it('never shows the reviewer key hash or the link to the owner or the reviewer', () => {
    const o = ownerComment(comment(), doc);
    const r = reviewerComment(comment(), doc);
    for (const v of [o, r]) {
      expect(JSON.stringify(v)).not.toContain('secret-hash');
      expect(JSON.stringify(v)).not.toContain('t'.repeat(22));
    }
    expect(o.where).toContain(job.role);
    expect(r.done).toBe(false);
  });

  it('the notice email says how many, never what was written or who wrote it', () => {
    const m = commentEmail('owner@example.com', {
      cvTitle: 'Driver CV',
      open: 2,
      docId: doc.id,
    });
    expect(m.subject).toBe('New comment on Driver CV');
    for (const body of [m.text, m.html]) {
      expect(body).toContain('2 comments');
      expect(body).toContain(`/cv/${doc.id}?tab=check#comments`);
      expect(body).toContain(`/cv/${doc.id}/download`);
      expect(body).not.toContain('Lead with the result');
      expect(body).not.toContain('Sara');
    }
    const one = commentEmail('owner@example.com', { cvTitle: '<b>x</b>', open: 1, docId: 'd' });
    expect(one.text).toContain('There is 1 comment');
    expect(one.html).not.toContain('<b>x</b>');
  });
});

describe('share comments: storage', () => {
  it('keeps comments under the document and deletes them with it and with the account', async () => {
    const store = new MemoryUserStore();
    await store.putComment('u1', comment({ id: 'a', createdAt: '2026-11-14T08:00:00.000Z' }));
    await store.putComment('u1', comment({ id: 'b', createdAt: '2026-11-14T09:00:00.000Z' }));
    await store.putComment('u1', comment({ id: 'x', docId: 'other' }));
    expect((await store.listComments('u1', doc.id)).map((c) => c.id)).toEqual(['b', 'a']);
    expect(await store.listComments('u2', doc.id)).toEqual([]);
    await store.deleteComment('u1', doc.id, 'a');
    expect((await store.listComments('u1', doc.id)).map((c) => c.id)).toEqual(['b']);
    await store.deleteDoc('u1', doc.id, new Date().toISOString());
    expect(await store.listComments('u1', doc.id)).toEqual([]);
    expect(await store.listComments('u1', 'other')).toHaveLength(1);
    await store.deleteUserData('u1');
    expect(await store.listComments('u1', 'other')).toEqual([]);
  });
});
