import { readJson } from '@/lib/http';
import { apiError } from '@/lib/http';
import { businessConfig } from '@/modules/billing/config';
import { getBusinessConfig, invalidateConfigCache } from '@/modules/billing/server';
import { actor, diffSummary, json, withAdmin } from '@/modules/admin/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Current business config + version history. */
export function GET() {
  return withAdmin(async () => {
    const [cfg, versions] = await Promise.all([
      getBusinessConfig(true),
      getUserStore().listConfigVersions('business'),
    ]);
    return json({
      version: cfg.version,
      value: cfg.value,
      versions: versions.map((v) => ({
        version: v.version,
        savedAt: v.savedAt,
        savedBy: v.savedBy,
      })),
    });
  });
}

/** PUT { baseVersion, value } — validated; refused if someone saved in between. */
export function PUT(req: Request) {
  return withAdmin(async (admin, rid) => {
    const body = await readJson(req, 128 * 1024);
    if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
    const { baseVersion, value } = body.value as { baseVersion?: number; value?: unknown };
    const parsed = businessConfig.safeParse(value);
    if (!parsed.success)
      return apiError('INVALID_INPUT', 'Some settings are not valid.', rid, {
        issues: parsed.error.issues.slice(0, 10),
      });
    if (!parsed.data.designs.some((d) => d.enabled && d.tier === 'free'))
      return apiError('INVALID_INPUT', 'At least one design must be enabled and free.', rid);
    if (
      parsed.data.features.sales &&
      (!parsed.data.passes.some((p) => p.active) ||
        !parsed.data.payments.methods.some((m) => m.active))
    )
      return apiError(
        'INVALID_INPUT',
        'To open sales, keep at least one pass on sale and one payment method shown.',
        rid,
      );
    const current = await getBusinessConfig(true);
    if (baseVersion !== current.version)
      return json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Settings were changed by someone else. Reload to see the latest.',
          },
        },
        409,
      );
    const changes = diffSummary(current.value, parsed.data);
    if (!changes.length) return json({ version: current.version, changes: [] });
    const version = await getUserStore().saveConfig('business', parsed.data, actor(admin));
    await getUserStore().writeAudit({
      at: new Date().toISOString(),
      by: actor(admin),
      action: 'config.save',
      target: `business v${version}`,
      detail: changes.slice(0, 50),
    });
    invalidateConfigCache();
    return json({ version, changes });
  });
}
