import { z } from 'zod';
import type { ResumeDocument } from '@/modules/resume/schema';

/**
 * Comments for reviewers (complete-studio-spec §9.1): a share link can allow comments, and a
 * friend or mentor leaves notes on specific lines. Comments are stored under the document
 * (users/{uid}/documents/{id}/comments/{id}, spec §12.3).
 *
 * Reviewers don't sign in. Each browser keeps a random reviewer key; the server keeps only its
 * hash, so a reviewer sees and deletes only their own comments, and nobody else with the link
 * sees them. The CV's owner sees all of them.
 */
export const MAX_COMMENTS_PER_DOC = 200;
export const MAX_TEXT = 1000;
export const MAX_AUTHOR = 60;
export const MAX_QUOTE = 300;

export type CommentStatus = 'open' | 'done';
export type ShareComment = {
  id: string;
  docId: string;
  /** The share link it came through. */
  token: string;
  /** Where on the CV: '' (the whole CV), 'basics', 'basics/<field>', '<sectionId>' or '<sectionId>/<itemId>'. */
  ref: string;
  /** The words the reviewer clicked on, when they are really on the CV. */
  quote: string;
  text: string;
  author: string;
  /** sha256 of the reviewer's browser key. Never sent to the owner. */
  keyHash: string;
  createdAt: string;
  status: CommentStatus;
};

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Plain text only: control characters removed, line breaks kept (max 3 in a row). */
const plain = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const reviewerKey = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/);

export const commentInput = z.object({
  ref: z.string().max(140).default(''),
  quote: z.string().max(2000).default(''),
  text: z
    .string()
    .transform(plain)
    .pipe(
      z
        .string()
        .min(1, 'Write a comment.')
        .max(MAX_TEXT, `Keep comments under ${MAX_TEXT} characters.`),
    ),
  author: z
    .string()
    .transform((s) => clean(plain(s)))
    .pipe(
      z
        .string()
        .min(1, 'Add your name, so they know who it is from.')
        .max(MAX_AUTHOR, `Keep your name under ${MAX_AUTHOR} characters.`),
    ),
  key: reviewerKey,
  /** Honeypot: people never fill it in. */
  website: z.string().max(200).optional(),
});
export type CommentInput = z.infer<typeof commentInput>;

const BASICS_FIELDS = ['name', 'headline', 'email', 'phone', 'location', 'summary', 'contact'];

/** Keeps a ref only if it points at something on this CV ('' otherwise: the whole CV). */
export function checkRef(doc: ResumeDocument, ref: string): string {
  const r = ref.trim();
  if (!r) return '';
  const [a, b, extra] = r.split('/');
  if (extra !== undefined) return '';
  if (a === 'basics') return !b || BASICS_FIELDS.includes(b) ? r : '';
  const section = doc.sections.find((s) => s.id === a && !s.hidden);
  if (!section) return '';
  if (b === undefined) return r;
  return section.items.some((i) => i.id === b) ? r : '';
}

/** Every piece of text on the CV, for checking that a quote is really there. */
function allText(doc: ResumeDocument): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) if (k !== 'photo' && k !== 'id') walk(x);
  };
  walk(doc.basics);
  doc.sections.filter((s) => !s.hidden).forEach((s) => walk(s));
  return clean(out.join(' \u0001 ')).toLowerCase();
}

/** The clicked words, kept only when they are on the CV (so a quote can't put words in its mouth). */
export function checkQuote(doc: ResumeDocument, quote: string): string {
  const q = clean(plain(quote));
  if (q.length < 2) return '';
  const short = q.length > MAX_QUOTE ? `${q.slice(0, MAX_QUOTE - 1).trimEnd()}…` : q;
  return allText(doc).includes(q.toLowerCase()) ? short : '';
}

export type CommentTarget = { ref: string; label: string };

/** The parts of the CV a reviewer can pick (the keyboard path; clicking the page also works). */
export function commentTargets(doc: ResumeDocument): CommentTarget[] {
  const out: CommentTarget[] = [{ ref: '', label: 'The whole CV' }];
  out.push({ ref: 'basics', label: 'Name and contact details' });
  if (clean(doc.basics.summary)) out.push({ ref: 'basics/summary', label: 'Profile' });
  for (const s of doc.sections) {
    if (s.hidden) continue;
    const title = clean(s.title) || 'Section';
    out.push({ ref: s.id, label: title });
    for (const i of s.items) {
      const label = itemLabel(i as Record<string, unknown>);
      if (label) out.push({ ref: `${s.id}/${i.id}`, label: `${title} — ${label}` });
    }
  }
  return out;
}

function itemLabel(item: Record<string, unknown>): string {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = item[k];
      if (typeof v === 'string' && clean(v)) return clean(v);
    }
    return '';
  };
  const main = pick('role', 'qualification', 'name', 'title', 'label', 'language', 'text', 'quote');
  const at = pick('organization', 'institution', 'issuer', 'subtitle');
  const s = [main, at].filter(Boolean).join(', ');
  return s.length > 80 ? `${s.slice(0, 79).trimEnd()}…` : s;
}

/** A label for where a comment is, from the CV as it is now. */
export function targetLabel(doc: ResumeDocument | null, ref: string): string {
  if (!ref) return 'The whole CV';
  if (!doc) return 'Part of the CV';
  if (ref === 'basics/contact' || ref === 'basics') return 'Name and contact details';
  if (ref.startsWith('basics/')) {
    const f = ref.slice(7);
    return f === 'summary' ? 'Profile' : f.charAt(0).toUpperCase() + f.slice(1);
  }
  return commentTargets(doc).find((t) => t.ref === ref)?.label ?? 'A part that was removed';
}

/** What the CV's owner sees. */
export const ownerComment = (c: ShareComment, doc: ResumeDocument | null) => ({
  id: c.id,
  ref: c.ref,
  where: targetLabel(doc, c.ref),
  quote: c.quote,
  text: c.text,
  author: c.author,
  createdAt: c.createdAt,
  status: c.status,
});
export type OwnerComment = ReturnType<typeof ownerComment>;

/** What a reviewer sees of their own comment. */
export const reviewerComment = (c: ShareComment, doc: ResumeDocument | null) => ({
  id: c.id,
  where: targetLabel(doc, c.ref),
  quote: c.quote,
  text: c.text,
  author: c.author,
  createdAt: c.createdAt,
  done: c.status === 'done',
});
export type ReviewerComment = ReturnType<typeof reviewerComment>;
