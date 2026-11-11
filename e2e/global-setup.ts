import { request, type FullConfig } from '@playwright/test';
import { DEFAULT_CONFIG } from '../src/modules/billing/config';
import { setConfig } from './support/auth';

/** Premium test users get unlimited use; free/visitor rules stay at defaults (tests change them). */
export default async function globalSetup(config: FullConfig) {
  const ctx = await request.newContext({ baseURL: config.projects[0]!.use.baseURL! });
  await setConfig(ctx, {
    ...DEFAULT_CONFIG,
    plans: {
      ...DEFAULT_CONFIG.plans,
      premium: {
        label: 'Premium',
        limits: { 'pdf.download': -1, 'import.cv': -1, 'ai.action': -1 },
      },
    },
  });
  await ctx.dispose();
}
