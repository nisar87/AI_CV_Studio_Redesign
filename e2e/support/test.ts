import { test as base, expect } from '@playwright/test';
import { apiSignUp, setPremium } from './auth';

/**
 * Every test gets its own fresh account (Auth emulator), signed in on both the browser context and
 * the `request` fixture, with Premium — unless it opts out with `test.use({ as: 'visitor' | 'free' })`.
 * Separate accounts keep cloud sync from mixing CVs between parallel tests.
 */
export type As = 'premium' | 'free' | 'visitor';

export const test = base.extend<{ as: As }>({
  as: ['premium', { option: true }],
  context: async ({ context, as }, provide) => {
    if (as !== 'visitor') {
      await apiSignUp(context.request);
      if (as === 'premium') await setPremium(context.request, true);
    }
    await provide(context);
  },
  request: async ({ request, as }, provide) => {
    if (as !== 'visitor') {
      await apiSignUp(request);
      if (as === 'premium') await setPremium(request, true);
    }
    await provide(request);
  },
});

export { expect };
