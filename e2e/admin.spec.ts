import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Browser } from '@playwright/test';
import { expect, test } from './support/test';
import { apiSignUp, makeAdmin, setConfig, uniqueEmail, EMULATOR, PASSWORD } from './support/auth';
import { DEFAULT_CONFIG } from '../src/modules/billing/config';
import { driver } from '../src/modules/resume/fixtures';

/**
 * R1.3 — Admin Console. Runs in its own Playwright project after all other specs, because it
 * changes site-wide settings. Every test leaves the config as it found it (afterEach).
 */
test.describe.configure({ mode: 'serial' });
test.use({ as: 'free' });

const BASE = {
  ...DEFAULT_CONFIG,
  plans: {
    ...DEFAULT_CONFIG.plans,
    premium: { label: 'Premium', limits: { 'pdf.download': -1, 'import.cv': -1, 'ai.action': -1 } },
  },
};

async function adminPage(browser: Browser) {
  const context = await browser.newContext();
  const email = await apiSignUp(context.request, uniqueEmail('admin'));
  await makeAdmin(context.request, email);
  return { context, page: await context.newPage(), email };
}

test.afterEach(async ({ request }) => {
  await setConfig(request, BASE);
});

test('non-admins are refused by the API and the UI', async ({ page, request }) => {
  for (const path of [
    '/api/admin/overview',
    '/api/admin/config',
    '/api/admin/users',
    '/api/admin/audit',
    '/api/admin/ai/eval',
  ])
    expect((await request.get(path)).status(), path).toBe(403);
  expect((await request.put('/api/admin/config', { data: {} })).status()).toBe(403);
  expect(
    (await request.post('/api/admin/users/x', { data: { action: 'grant', days: 9 } })).status(),
  ).toBe(403);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Administrators only' })).toBeVisible();
});

test('visitors are asked to sign in', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  expect((await context.request.get('/api/admin/overview')).status()).toBe(401);
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Sign in' }).last()).toBeVisible();
  await context.close();
});

test('admin changes settings; the gate follows; history records and restores', async ({
  browser,
  request,
}) => {
  const { context, page } = await adminPage(browser);
  await page.goto('/admin');
  await expect(page.getByTestId('admin-stats')).toContainText('Accounts');
  await expect(page.getByTestId('admin-numbers')).toContainText('New accounts');
  await expect(page.getByRole('meter', { name: 'AI daily budget used' })).toBeVisible();
  const o = (await (await context.request.get('/api/admin/overview')).json()) as {
    numbers: { newAccounts: number };
  };
  expect(o.numbers.newAccounts).toBeGreaterThan(0);

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Free: PDF downloads per month').fill('0');
  await page.getByLabel('Vivid tier').selectOption('premium');
  await page.getByLabel('Show the announcement').check();
  await page.getByLabel('Message').fill('Welcome to the new studio');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/Saved as version \d+ \(4 changes\)/)).toBeVisible();

  // The free account (request fixture) now sees the new rules from the server.
  const ent = (await (await request.get('/api/me/entitlements')).json()) as {
    limits: Record<string, number>;
    designs: { id: string; tier: string }[];
    announcement: string | null;
  };
  expect(ent.limits['pdf.download']).toBe(0);
  expect(ent.designs.find((d) => d.id === 'vivid')?.tier).toBe('premium');
  expect(ent.announcement).toBe('Welcome to the new studio');
  const pdf = await request.post('/api/pdf', { data: { document: driver } });
  expect(pdf.status()).toBe(402);

  await page.goto('/');
  await expect(
    page.getByRole('status').filter({ hasText: 'Welcome to the new studio' }),
  ).toBeVisible();

  // History: the save is audited with a readable diff, and the previous version can be restored.
  await page.goto('/admin/history');
  const audit = page.getByTestId('audit-log');
  await expect(audit).toContainText('Saved settings');
  await expect(audit).toContainText('plans.free.limits.pdf.download: 30 → 0');
  const versions = page.getByTestId('config-versions');
  page.once('dialog', (d) => void d.accept());
  await versions.getByRole('button', { name: 'Restore' }).first().click();
  await expect(page.getByText(/restored as version/)).toBeVisible();
  await expect(audit).toContainText('Restored settings');
  const after = (await (await request.get('/api/me/entitlements')).json()) as {
    limits: Record<string, number>;
  };
  expect(after.limits['pdf.download']).toBe(30);
  await context.close();
});

test('the support email set in Settings appears on Help and Terms', async ({ browser, page }) => {
  const { context, page: admin } = await adminPage(browser);
  await admin.goto('/admin/settings');
  await admin.getByLabel('Support email').fill('help@example.com');
  await admin.getByRole('button', { name: 'Save changes' }).click();
  await expect(admin.getByText(/Saved as version/)).toBeVisible();
  await context.close();
  // Pages read the setting through a 60-second cache; wait for it.
  await expect
    .poll(
      async () => {
        await page.goto('/help');
        return page.getByTestId('support-contact').isVisible();
      },
      { timeout: 90_000, intervals: [5_000] },
    )
    .toBe(true);
  await expect(page.getByTestId('support-contact')).toContainText('help@example.com');
  await page.goto('/terms');
  await expect(page.getByRole('link', { name: 'help@example.com' }).first()).toBeVisible();
});

test('a stale save is refused instead of overwriting someone else', async ({ browser }) => {
  const { context, page } = await adminPage(browser);
  await page.goto('/admin/settings');
  await page.getByLabel('Message').fill('first tab');
  // Someone else saves in between.
  await setConfig(context.request, { ...BASE, announcement: { enabled: false, text: 'other' } });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('changed by someone else');
  await context.close();
});

test('admin grants Premium to a user by email, then removes it', async ({ browser, request }) => {
  const target = await fixtureAccountEmail(request);
  const { context, page } = await adminPage(browser);
  await page.goto('/admin/users');
  await page.getByLabel('Email address').fill(target);
  await page.getByRole('button', { name: 'Find' }).click();
  const card = page.getByTestId('admin-user');
  await expect(card.getByTestId('admin-user-plan')).toHaveText('Free');
  await card.getByRole('button', { name: '30 days' }).click();
  await expect(card.getByTestId('admin-user-plan')).toHaveText('Premium');
  expect(
    ((await (await request.get('/api/me/entitlements')).json()) as { plan: string }).plan,
  ).toBe('premium');
  page.once('dialog', (d) => void d.accept());
  await card.getByRole('button', { name: 'Remove Premium' }).click();
  await expect(card.getByTestId('admin-user-plan')).toHaveText('Free');
  await page.goto('/admin/history');
  await expect(page.getByTestId('audit-log')).toContainText('Granted Premium');
  await expect(page.getByTestId('audit-log')).toContainText('Removed Premium');
  await context.close();
});

test('pausing sign-ups blocks new accounts but not existing ones', async ({ request }) => {
  await setConfig(request, { ...BASE, features: { ...BASE.features, signups: false } });
  await expect(apiSignUp(request, uniqueEmail('new'))).rejects.toThrow(/403/);
  // The fixture's own (existing) account can still sign in again.
  const again = await signInAgain(request);
  expect(again).toBe(200);
});

test('maintenance mode pauses downloads and shows a notice', async ({ page, request }) => {
  await setConfig(request, { ...BASE, features: { ...BASE.features, maintenance: true } });
  const r = await request.post('/api/pdf', { data: { document: driver } });
  expect(r.status()).toBe(403);
  expect(((await r.json()) as { error: { message: string } }).error.message).toContain(
    'being updated',
  );
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'being updated' })).toBeVisible();
});

test('the AI page runs the live evaluation in batches and reports the pass mark', async ({
  browser,
}) => {
  const { context, page } = await adminPage(browser);
  await page.goto('/admin/ai');
  await page.getByRole('button', { name: /Run evaluation \(48 samples\)/ }).click();
  await expect(page.getByText('Passed: no invented facts reached the text.')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId('eval-summary')).toContainText('48 / 48');
  expect((await context.request.post('/api/admin/ai/eval', { data: {} })).ok()).toBe(true);
  await context.close();
});

test('console pages have no serious accessibility problems', async ({ browser }) => {
  const { context, page } = await adminPage(browser);
  for (const path of ['/admin', '/admin/users', '/admin/settings', '/admin/ai', '/admin/history']) {
    await page.goto(path);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${path}: ${v.id}`),
    ).toEqual([]);
  }
  await context.close();
});

// --- helpers ---

/** The `request` fixture is already signed in as a fresh free account; this is its email. */
async function fixtureAccountEmail(request: APIRequestContext) {
  const me = (await (await request.get('/api/me')).json()) as { user: { email: string } };
  return me.user.email;
}

async function signInAgain(request: APIRequestContext) {
  const me = (await (await request.get('/api/me')).json()) as { user: { email: string } };
  const s = await request.post(
    `${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key`,
    { data: { email: me.user.email, password: PASSWORD, returnSecureToken: true } },
  );
  const { idToken } = (await s.json()) as { idToken: string };
  return (await request.post('/api/session', { data: { idToken } })).status();
}
