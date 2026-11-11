import { apiError, readJson } from '@/lib/http';
import { parseConfig } from '@/modules/billing/config';
import { getBusinessConfig, invalidateConfigCache } from '@/modules/billing/server';
import { actor, diffSummary, json, withAdmin } from '@/modules/admin/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST { version } — saves an earlier version as the new current version. */
export function POST(req: Request) {
  return withAdmin(async (admin, rid) => {
    const body = await readJson(req, 4 * 1024);
    const version = body.ok ? Number((body.value as { version?: unknown }).version) : NaN;
    const entry = (await getUserStore().listConfigVersions('business')).find(
      (v) => v.version === version,
    );
    if (!entry) return apiError('NOT_FOUND', 'That version was not found.', rid);
    const current = await getBusinessConfig(true);
    const value = parseConfig(entry.value);
    const next = await getUserStore().saveConfig('business', value, actor(admin));
    await getUserStore().writeAudit({
      at: new Date().toISOString(),
      by: actor(admin),
      action: 'config.restore',
      target: `business v${version} → v${next}`,
      detail: diffSummary(current.value, value).slice(0, 50),
    });
    invalidateConfigCache();
    return json({ version: next });
  });
}
