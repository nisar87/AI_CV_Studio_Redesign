import { json, withAdmin } from '@/modules/admin/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET ?status=pending|all → payment requests, newest first. */
export function GET(req: Request) {
  return withAdmin(async () => {
    const status = new URL(req.url).searchParams.get('status');
    const store = getUserStore();
    const requests = await store.listPaymentRequests(
      status === 'pending' ? { status: 'pending', limit: 200 } : { limit: 200 },
    );
    return json({ requests });
  });
}
