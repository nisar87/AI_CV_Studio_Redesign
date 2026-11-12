import AxeBuilder from '@axe-core/playwright';
import type { Browser } from '@playwright/test';
import { expect, test } from './support/test';
import { apiSignUp, makeAdmin, setConfig, uniqueEmail } from './support/auth';
import { DEFAULT_CONFIG, type BusinessConfig } from '../src/modules/billing/config';

/**
 * R1.4 — Get Premium with manual payments: buyer → "I've paid" → admin approves/rejects.
 * Runs in the isolated "admin" Playwright project (it opens sales site-wide).
 */
test.describe.configure({ mode: 'serial' });
test.use({ as: 'free' });

const BASE: BusinessConfig = {
  ...DEFAULT_CONFIG,
  plans: {
    ...DEFAULT_CONFIG.plans,
    premium: { label: 'Premium', limits: { 'pdf.download': -1, 'import.cv': -1, 'ai.action': -1 } },
  },
};
const SALES: BusinessConfig = {
  ...BASE,
  features: { ...BASE.features, sales: true },
  payments: {
    instructions: 'Pay the exact amount, then enter the transaction ID.',
    methods: [
      {
        id: 'bank',
        label: 'Bank transfer',
        details: 'Account title: AI CV Studio\nIBAN: PK00TEST0000000000000000',
        active: true,
      },
      { id: 'jazz', label: 'JazzCash', details: 'Number: 0300 0000000', active: true },
      { id: 'old', label: 'Hidden method', details: 'x', active: false },
    ],
  },
};

async function admin(browser: Browser) {
  const context = await browser.newContext();
  const email = await apiSignUp(context.request, uniqueEmail('admin'));
  await makeAdmin(context.request, email);
  return { context, page: await context.newPage() };
}

test.afterEach(async ({ request }) => {
  await setConfig(request, BASE);
});

test('before sales open, Premium is described but cannot be bought', async ({ page, request }) => {
  await page.goto('/premium');
  await expect(page.getByRole('heading', { name: 'Premium opens soon' })).toBeVisible();
  await expect(page.getByRole('row', { name: /CV designs/ })).toBeVisible();
  const r = await request.post('/api/premium/request', {
    data: { passId: 'month', methodId: 'bank', reference: 'TID12345' },
  });
  expect(r.status()).toBe(403);
});

test('visitors see prices and are asked to sign in', async ({ browser, request }) => {
  await setConfig(request, SALES);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/premium');
  await expect(page.getByRole('radio', { name: /3 months/ })).toContainText('Best value');
  await expect(page.getByRole('link', { name: 'Sign in or create an account' })).toHaveAttribute(
    'href',
    '/signin?next=/premium',
  );
  expect((await context.request.post('/api/premium/request', { data: {} })).status()).toBe(401);
  await context.close();
});

test('buy → admin approves → Premium starts; the audit log records it', async ({
  page,
  request,
  browser,
}) => {
  await setConfig(request, SALES);
  await page.goto('/premium');
  await page.getByRole('radio', { name: /1 month/ }).click();
  await page.getByRole('radio', { name: 'JazzCash' }).click();
  const details = page.getByTestId('payment-details');
  await expect(details).toContainText('PKR 499');
  await expect(details).toContainText('0300 0000000');
  await expect(page.getByRole('radio', { name: 'Hidden method' })).toHaveCount(0);
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );

  await page.getByLabel('Transaction ID').fill('TID-998877');
  await page.getByRole('button', { name: 'I’ve paid PKR 499' }).click();
  await expect(page.getByTestId('premium-pending')).toContainText('TID-998877');

  // Only one request at a time; and a crafted request for a hidden method is refused.
  const again = await page.request.post('/api/premium/request', {
    data: { passId: 'month', methodId: 'bank', reference: 'TID-2' },
  });
  expect(again.status()).toBe(400);

  const { context, page: adminPage } = await admin(browser);
  await adminPage.goto('/admin');
  await expect(adminPage.getByText(/1 payment waiting/)).toBeVisible();
  await adminPage.getByRole('link', { name: 'Review payments' }).click();
  const row = adminPage.getByTestId('payment').filter({ hasText: 'TID-998877' });
  await expect(row).toContainText('PKR 499');
  await expect(row).toContainText('JazzCash');
  adminPage.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(adminPage.getByText(/Approved — Premium until/)).toBeVisible();

  const ent = (await (await page.request.get('/api/me/entitlements')).json()) as { plan: string };
  expect(ent.plan).toBe('premium');
  await page.reload();
  await expect(page.getByText(/You have Premium until/)).toBeVisible();

  // Approving twice is impossible (already handled).
  const id = (
    (await (await context.request.get('/api/admin/payments?status=all')).json()) as {
      requests: { id: string; reference: string }[];
    }
  ).requests.find((r) => r.reference === 'TID-998877')!.id;
  const twice = await context.request.post(`/api/admin/payments/${id}`, {
    data: { decision: 'approve' },
  });
  expect(twice.status()).toBe(409);

  await adminPage.goto('/admin/history');
  await expect(adminPage.getByTestId('audit-log')).toContainText('Approved payment');
  await expect(adminPage.getByTestId('audit-log')).toContainText('reference: TID-998877');
  await context.close();
});

test('the same transaction ID cannot be claimed twice, even by another account', async ({
  page,
  request,
}) => {
  await setConfig(request, SALES);
  const data = { passId: 'month', methodId: 'bank', reference: 'DUP-555 777' };
  expect((await page.request.post('/api/premium/request', { data })).status()).toBe(200);
  const other = await request.post('/api/premium/request', {
    data: { ...data, reference: 'dup555777' },
  });
  expect(other.status()).toBe(400);
  expect(((await other.json()) as { error: { message: string } }).error.message).toContain(
    'already been used',
  );
});

test('a rejected payment shows the reason and the buyer can try again', async ({
  page,
  request,
  browser,
}) => {
  await setConfig(request, SALES);
  await page.goto('/premium');
  await page.getByLabel('Transaction ID').fill('WRONG-1');
  await page.getByRole('button', { name: /I’ve paid/ }).click();
  await expect(page.getByTestId('premium-pending')).toBeVisible();

  const { context, page: adminPage } = await admin(browser);
  await adminPage.goto('/admin/payments');
  const row = adminPage.getByTestId('payment').filter({ hasText: 'WRONG-1' });
  adminPage.once('dialog', (d) => void d.accept('No payment with this ID arrived.'));
  await row.getByRole('button', { name: 'Reject' }).click();
  await expect(adminPage.getByText(/Rejected — the buyer/)).toBeVisible();
  await context.close();

  await page.reload();
  await expect(page.getByText('No payment with this ID arrived.')).toBeVisible();
  await expect(page.getByLabel('Transaction ID')).toBeVisible();
  const ent = (await (await page.request.get('/api/me/entitlements')).json()) as { plan: string };
  expect(ent.plan).toBe('free');
});

test('sales cannot be opened without a pass and a payment method', async ({ browser, request }) => {
  const { context, page } = await admin(browser);
  await page.goto('/admin/settings');
  await page.getByLabel(/Premium sales are open/).check();
  await expect(page.getByText('To open sales, keep at least one pass on sale')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  const bad = await context.request.put('/api/admin/config', {
    data: {
      baseVersion: (
        (await (await context.request.get('/api/admin/config')).json()) as { version: number }
      ).version,
      value: { ...BASE, features: { ...BASE.features, sales: true } },
    },
  });
  expect(bad.status()).toBe(400);
  await page.getByRole('button', { name: 'Add a payment method' }).click();
  await page.getByLabel('Account details').fill('IBAN: PK00TEST');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/Saved as version/)).toBeVisible();
  const offer = (await (await request.get('/api/premium')).json()) as {
    sales: boolean;
    methods: { label: string }[];
  };
  expect(offer.sales).toBe(true);
  expect(offer.methods.map((m) => m.label)).toEqual(['Bank transfer']);
  await context.close();
});
