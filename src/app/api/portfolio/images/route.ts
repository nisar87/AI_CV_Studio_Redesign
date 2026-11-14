import { NextResponse } from 'next/server';
import { apiError, createRateLimiter, readBytes, requestId } from '@/lib/http';
import { planFor } from '@/modules/billing/server';
import { currentUser } from '@/modules/identity/session';
import { track } from '@/modules/metrics/server';
import { MAX_IMAGE_BYTES, MAX_IMAGES, sniffImage } from '@/modules/portfolio/themes';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const g = globalThis as { __portfolioImageLimiter?: ReturnType<typeof createRateLimiter> };
const limit = (g.__portfolioImageLimiter ??= createRateLimiter({
  capacity: 30,
  refillPerMinute: 3,
}));

/**
 * POST (the picture's bytes; the browser resizes it first) → { image: { id } }. Premium, like the
 * portfolio. The type comes from the bytes; only WebP, JPEG and PNG up to 600 KB are kept.
 */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in.', rid);
  const { plan } = await planFor(user);
  if (plan !== 'premium')
    return apiError('PREMIUM_REQUIRED', 'Your portfolio page is part of Premium.', rid, {
      reason: 'premium',
    });
  const rl = limit(user.uid);
  if (!rl.ok)
    return apiError(
      'RATE_LIMITED',
      'That’s a lot of pictures at once. Please wait a minute.',
      rid,
      undefined,
      {
        'Retry-After': String(rl.retryAfterSec),
      },
    );
  const body = await readBytes(req, MAX_IMAGE_BYTES);
  if (!body.ok)
    return apiError('PAYLOAD_TOO_LARGE', 'That picture is too large, even after resizing.', rid);
  const type = sniffImage(body.bytes);
  if (!type) return apiError('UNPROCESSABLE', 'Use a photo or picture (JPG, PNG or WebP).', rid);
  const store = getUserStore();
  if ((await store.listPortfolioImages(user.uid)).length >= MAX_IMAGES)
    return apiError(
      'LIMIT_REACHED',
      `You can keep up to ${MAX_IMAGES} pictures. Remove some from your projects and save first.`,
      rid,
    );
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  await store.putPortfolioImage(user.uid, {
    id,
    type,
    data: Buffer.from(body.bytes).toString('base64'),
    bytes: body.bytes.byteLength,
    createdAt: new Date().toISOString(),
  });
  await track('portfolio_image');
  return NextResponse.json(
    { image: { id } },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}
