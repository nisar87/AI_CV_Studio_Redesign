import { NextResponse } from 'next/server';
import { apiError, clientKey, createRateLimiter, readJson, requestId } from '@/lib/http';
import { track } from '@/modules/metrics/server';
import {
  checkQuote,
  checkRef,
  commentInput,
  MAX_COMMENTS_PER_DOC,
  reviewerComment,
  reviewerKey,
  type ShareComment,
} from '@/modules/share/comments';
import { commentableShare, hashKey, noticeComments } from '@/modules/share/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string }> };
const noStore = { 'Cache-Control': 'no-store' };

// Reviewers don't sign in, so comments are limited per network address and per link.
const g = globalThis as {
  __commentIpLimiter?: ReturnType<typeof createRateLimiter>;
  __commentLinkLimiter?: ReturnType<typeof createRateLimiter>;
};
const perIp = (g.__commentIpLimiter ??= createRateLimiter({ capacity: 10, refillPerMinute: 1 }));
const perLink = (g.__commentLinkLimiter ??= createRateLimiter({
  capacity: 30,
  refillPerMinute: 0.5,
}));

const closed = (rid: string) =>
  apiError('NOT_FOUND', 'Comments aren’t open on this link.', rid, undefined, noStore);

/** GET (header x-reviewer-key) → this browser's own comments on the link. */
export async function GET(req: Request, ctx: Ctx) {
  const rid = requestId();
  const r = await commentableShare((await ctx.params).token);
  if (!r) return closed(rid);
  const key = reviewerKey.safeParse(req.headers.get('x-reviewer-key') ?? '');
  if (!key.success) return NextResponse.json({ comments: [] }, { headers: noStore });
  const mine = hashKey(key.data);
  const comments = (await getUserStore().listComments(r.share.uid, r.share.docId))
    .filter((c) => c.keyHash === mine && c.token === r.share.token)
    .map((c) => reviewerComment(c, r.doc));
  return NextResponse.json({ comments }, { headers: noStore });
}

/** POST { ref, quote, text, author, key } → leaves a comment for the CV's owner. */
export async function POST(req: Request, ctx: Ctx) {
  const rid = requestId();
  const token = (await ctx.params).token;
  const r = await commentableShare(token);
  if (!r) return closed(rid);
  const body = await readJson(req, 8 * 1024);
  if (!body.ok)
    return apiError(
      body.code,
      body.code === 'PAYLOAD_TOO_LARGE' ? 'This comment is too long.' : 'Invalid request.',
      rid,
    );
  const parsed = commentInput.safeParse(body.value);
  if (!parsed.success)
    return apiError(
      'INVALID_INPUT',
      parsed.error.issues[0]?.message ?? 'Check your comment and try again.',
      rid,
    );
  const input = parsed.data;
  const store = getUserStore();
  if (input.website) {
    // A form-filling robot: look successful, store nothing.
    return NextResponse.json({ comment: null }, { status: 201, headers: noStore });
  }
  const ip = perIp(clientKey(req));
  const link = ip.ok ? perLink(token) : ip;
  if (!ip.ok || !link.ok)
    return apiError(
      'RATE_LIMITED',
      'That’s a lot of comments in a short time. Please wait a few minutes.',
      rid,
      undefined,
      { 'Retry-After': String(Math.max(ip.retryAfterSec, link.retryAfterSec)) },
    );
  const existing = await store.listComments(r.share.uid, r.share.docId);
  if (existing.length >= MAX_COMMENTS_PER_DOC)
    return apiError(
      'LIMIT_REACHED',
      'This CV has as many comments as it can hold. Let its owner know another way.',
      rid,
    );
  const comment: ShareComment = {
    id: crypto.randomUUID(),
    docId: r.share.docId,
    token,
    ref: checkRef(r.doc, input.ref),
    quote: checkQuote(r.doc, input.quote),
    text: input.text,
    author: input.author,
    keyHash: hashKey(input.key),
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  await store.putComment(r.share.uid, comment);
  await track('share_comment');
  // Awaited: on Cloud Run, work left running after the response may never finish.
  await noticeComments(r.share, r.doc.title || r.doc.basics.name || 'your CV');
  return NextResponse.json(
    { comment: reviewerComment(comment, r.doc) },
    { status: 201, headers: noStore },
  );
}
