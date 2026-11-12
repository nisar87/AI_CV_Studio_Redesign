import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { expect, test } from './support/test';

/**
 * R1.1 — accounts and cloud documents, against the Firebase Auth emulator and the server's
 * in-memory document store. Two browser contexts act as two devices.
 */
test.describe.configure({ mode: 'serial' });
test.use({ as: 'visitor' });

const PASSWORD = 'Correct-Horse-9!';
const uniqueEmail = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function axeClean(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
}

async function signUp(page: Page, email: string, next = '/cv') {
  await page.goto(`/signin?mode=signup&next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByLabel('I am 18 or older and agree to the privacy notice').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, '\\/')}$`));
}

async function signIn(page: Page, email: string, next = '/cv') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, '\\/')}$`));
}

async function newDevice(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

/** Names on the CVs stored on this device. */
async function localNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('cvstudio:v1:doc:'))
      .map((k) => JSON.parse(localStorage.getItem(k)!).basics.name as string)
      .sort(),
  );
}

async function makeCv(page: Page, name: string) {
  await page.goto('/cv/new?work=driver');
  await expect(page).toHaveURL(/\/guided$/);
  await page.getByLabel('Full name').fill(name);
  await page.waitForTimeout(700); // autosave
}

test('APIs refuse requests without a session', async ({ request }) => {
  expect((await request.get('/api/documents')).status()).toBe(401);
  expect((await request.put('/api/documents/abc', { data: { document: {} } })).status()).toBe(401);
  expect(await (await request.get('/api/me')).json()).toEqual({ user: null });
  expect((await request.post('/api/session', { data: { idToken: 'not-a-token' } })).status()).toBe(
    401,
  );
});

test('sign up: password rules, 18+ confirmation, then signed in with the account page', async ({
  page,
}) => {
  await page.goto('/signin?mode=signup');
  await axeClean(page);
  await page.getByLabel('Email').fill(uniqueEmail('rules'));
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(/meets all the requirements/);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(/18 or older/);

  const email = uniqueEmail('new');
  await signUp(page, email, '/account');
  await expect(page.locator('dd').filter({ hasText: email })).toBeVisible();
  await expect(page.getByText('Not verified yet')).toBeVisible();
  await expect(page.getByText('Please verify your email')).toBeVisible();
  await axeClean(page);
});

test('wrong password shows a plain message; reset does not reveal accounts', async ({ page }) => {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(uniqueEmail('nobody'));
  await page.getByLabel('Password', { exact: true }).fill('Wrong-password-1!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(/don’t match/);
  await page.getByRole('button', { name: 'Forgot your password?' }).click();
  await page.getByLabel('Email').fill(uniqueEmail('nobody'));
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText(/If an account exists for this email/)).toBeVisible();
});

test('a CV made before signing in moves into the account and appears on another device', async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, 'Covered on desktop');
  const email = uniqueEmail('sync');
  const a = await newDevice(browser);
  await makeCv(a.page, 'Imran Qureshi');
  await signUp(a.page, email);
  await expect(a.page.getByText('Your CVs are saved to your account')).toBeVisible();
  await expect(a.page.getByRole('link', { name: 'Open My CV' })).toHaveCount(1);
  // Wait until the account copy exists.
  await expect
    .poll(async () => (await (await a.page.request.get('/api/documents')).json()).documents.length)
    .toBe(1);

  const b = await newDevice(browser);
  await b.page.goto('/cv');
  await expect(b.page.getByText('No CVs on this device yet')).toBeVisible();
  await signIn(b.page, email);
  // First sync on a new device downloads the CVs; allow for a busy machine (full parallel suite).
  await expect(b.page.getByRole('link', { name: 'Open My CV' })).toHaveCount(1, {
    timeout: 20_000,
  });
  await expect.poll(() => localNames(b.page)).toEqual(['Imran Qureshi']);

  // Edit on A → after B refreshes, B shows the new name.
  await a.page
    .getByRole('button', { name: /^Options for/ })
    .first()
    .click();
  await a.page.getByRole('menuitem', { name: 'Edit' }).click();
  await a.page.getByLabel('Full name').fill('Imran Q. Qureshi');
  await expect
    .poll(
      async () => {
        const list = (await (await a.page.request.get('/api/documents')).json()).documents as {
          id: string;
        }[];
        const doc = await (await a.page.request.get(`/api/documents/${list[0]!.id}`)).json();
        return doc.doc.basics.name;
      },
      { timeout: 15_000 },
    )
    .toBe('Imran Q. Qureshi');
  await b.page.goto('/cv');
  await expect.poll(() => localNames(b.page)).toEqual(['Imran Q. Qureshi']);

  // Opening the CV by link on a third, fresh device waits for the account copy.
  const list = (await (await a.page.request.get('/api/documents')).json()).documents as {
    id: string;
  }[];
  const c = await newDevice(browser);
  await signIn(c.page, email, '/account');
  await c.page.goto(`/cv/${list[0]!.id}`);
  await expect(c.page.getByLabel('Full name')).toHaveValue('Imran Q. Qureshi');

  // Sign out on B: the account's CV leaves B, but stays in the account.
  await b.page.goto('/account');
  await b.page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(b.page).toHaveURL(/\/$/);
  await b.page.goto('/cv');
  await expect(b.page.getByText('No CVs on this device yet')).toBeVisible();
  await signIn(b.page, email);
  await expect.poll(() => localNames(b.page)).toEqual(['Imran Q. Qureshi']);

  // Delete on B → gone on A after refresh.
  await b.page
    .getByRole('button', { name: /^Options for/ })
    .first()
    .click();
  await b.page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect
    .poll(
      async () =>
        (await (await a.page.request.get('/api/documents')).json()).documents.filter(
          (d: { deleted: boolean }) => !d.deleted,
        ).length,
    )
    .toBe(0);
  await a.page.goto('/cv');
  await expect(a.page.getByText('No CVs on this device yet')).toBeVisible();
  await Promise.all([a.ctx.close(), b.ctx.close(), c.ctx.close()]);
});

test('an existing account (made before the redesign) can sign in', async ({ page, request }) => {
  const email = uniqueEmail('old');
  const r = await request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-key',
    {
      data: { email, password: PASSWORD, returnSecureToken: true },
    },
  );
  expect(r.ok()).toBe(true);
  await signIn(page, email, '/account');
  await expect(page.locator('dd').filter({ hasText: email })).toBeVisible();
  expect((await (await page.request.get('/api/me')).json()).user.email).toBe(email);
});

test('deleting the account removes its CVs and the sign-in', async ({ page, browser }) => {
  const email = uniqueEmail('delete');
  await signUp(page, email);
  await makeCv(page, 'Zara Deleteme');
  await page.goto('/cv');
  await expect
    .poll(
      async () => (await (await page.request.get('/api/documents')).json()).documents?.length ?? 0,
    )
    .toBe(1);

  await page.goto('/account');
  const del = page.getByRole('button', { name: 'Delete my account' });
  await expect(del).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await del.click();
  await expect(page).toHaveURL(/\/$/);
  expect(await localNames(page)).toEqual([]);
  expect((await page.request.get('/api/documents')).status()).toBe(401);

  // The account no longer exists.
  const { ctx, page: other } = await newDevice(browser);
  await other.goto('/signin?next=/cv');
  await other.getByLabel('Email').fill(email);
  await other.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await other.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(other.locator('p[role="alert"]')).toBeVisible();
  await ctx.close();
});
