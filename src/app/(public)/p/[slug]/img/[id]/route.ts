import { resolvePortfolio, imageResponse } from '@/modules/portfolio/server';
import { usedImages } from '@/modules/portfolio/themes';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ slug: string; id: string }> };

/** A picture on a published portfolio page: only while the page is live and the picture is on it. */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const r = /^[\w-]{1,40}$/.test(id) ? await resolvePortfolio(slug) : null;
  if (!r || !usedImages(r.portfolio.projects).has(id))
    return new Response('Not found', { status: 404 });
  const img = await getUserStore().getPortfolioImage(r.portfolio.uid, id);
  if (!img) return new Response('Not found', { status: 404 });
  return imageResponse(img, 'public, max-age=3600');
}
