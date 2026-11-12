import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';
import { apiSignUp, setPremium } from './support/auth';

/** R3: public portfolio page (Premium). */
async function synced(page: import('@playwright/test').Page) {
  await seedDocument(page, driver);
  await page.goto('/cv');
  await expect
    .poll(async () => (await page.request.get(`/api/documents/${driver.id}`)).status(), {
      timeout: 15_000,
    })
    .toBe(200);
}

test('premium: publish, visit as a stranger, contact privacy, unpublish', async ({
  page,
  browser,
}, info) => {
  await synced(page);
  await expect(page.getByTestId('presence-links')).toBeVisible();
  await page.getByRole('link', { name: 'Portfolio page' }).click();
  const slug = `imran-${info.project.name}-${Date.now().toString(36)}`;
  const address = page.getByLabel('Your address');
  await expect(address).toHaveValue('imran-qureshi');
  // Reserved and malformed addresses are refused in the form.
  await address.fill('admin');
  await expect(page.getByText('That address is reserved.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create my page' })).toBeDisabled();
  await address.fill(slug);
  await page.getByRole('button', { name: 'Create my page' }).click();
  await expect(page.getByTestId('portfolio-live')).toContainText(`/p/${slug}`);

  const stranger = await browser.newContext();
  const s = await stranger.newPage();
  await s.goto(`/p/${slug}`);
  await expect(s.getByRole('heading', { name: 'Imran Qureshi', level: 1 })).toBeVisible();
  await expect(s.getByText('Deliver around 120 parcels a day')).toBeVisible();
  await expect(s.getByRole('heading', { name: 'Multi-drop Van Driver' })).toBeVisible();
  await expect(s).toHaveTitle('Imran Qureshi — Multi-drop Delivery Driver');
  // Email and phone are hidden unless the owner chooses to show them.
  await expect(s.getByText('imran.qureshi@example.com')).toHaveCount(0);
  await expect(s.getByText('07700 900123')).toHaveCount(0);
  await expect(s.getByText('Leicester').first()).toBeVisible();
  const axe = await new AxeBuilder({ page: s }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );

  await page.getByLabel('Show my email address').check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Your page is live').first()).toBeVisible();
  await s.reload();
  await expect(s.getByRole('link', { name: 'imran.qureshi@example.com' })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('portfolio-views')).toContainText('Visited 2 times');

  // Unpublish: the address stops working.
  await page.getByLabel('Page is published').uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved. Your page is hidden.')).toBeVisible();
  expect((await s.goto(`/p/${slug}`))?.status()).toBe(404);
  await stranger.close();
});

test('an address taken by someone else is refused', async ({ page, browser }, info) => {
  await synced(page);
  const slug = `taken-${info.project.name}-${Date.now().toString(36)}`;
  const put = (p: import('@playwright/test').Page) =>
    p.request.put('/api/portfolio', {
      data: { slug, docId: driver.id, published: true },
    });
  expect((await put(page)).status()).toBe(200);
  // A second Premium account.
  const other = await browser.newContext();
  await apiSignUp(other.request);
  await setPremium(other.request, true);
  const o = await other.newPage();
  await seedDocument(o, driver);
  await o.goto('/cv');
  await expect
    .poll(async () => (await o.request.get(`/api/documents/${driver.id}`)).status(), {
      timeout: 15_000,
    })
    .toBe(200);
  const r = await put(o);
  expect(r.status()).toBe(409);
  await other.close();
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('sees the Premium offer; publishing is refused', async ({ page }) => {
    await synced(page);
    await page.goto('/portfolio');
    await expect(page.getByText('Your portfolio page is part of Premium')).toBeVisible();
    const r = await page.request.put('/api/portfolio', {
      data: { slug: 'free-person-x', docId: driver.id, published: true },
    });
    expect(r.status()).toBe(402);
    expect((await page.goto('/p/free-person-x'))?.status()).toBe(404);
  });
});
