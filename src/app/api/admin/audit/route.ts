import { json, withAdmin } from '@/modules/admin/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return withAdmin(async () => json({ entries: await getUserStore().listAudit(200) }));
}
