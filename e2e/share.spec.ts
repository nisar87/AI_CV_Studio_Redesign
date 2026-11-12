import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R3: read-only share links for CVs. */
test.describe('free account', () => {
  test.use({ as: 'free' });

  test('create, open as a stranger, count views, switch off and on, delete', async ({
    page,
    browser,
  }) => {
    await seedDocument(page, driver);
    await page.goto('/cv'); // syncs the seeded CV into the account
    // Wait until the CV is in the account (the link needs the cloud copy).
    await expect
      .poll(async () => (await page.request.get(`/api/documents/${driver.id}`)).status(), {
        timeout: 15_000,
      })
      .toBe(200);
    await page.goto(`/cv/${driver.id}/download`);
    const panel = page.getByTestId('share-panel');
    await panel.getByRole('button', { name: 'Create a link' }).click();
    const link = await panel.getByLabel('Link to your CV').inputValue();
    expect(link).toMatch(/\/s\/[A-Za-z0-9_-]{20,}$/);

    // A stranger (no account) sees the CV, read-only, not indexed.
    const stranger = await browser.newContext();
    const s = await stranger.newPage();
    await s.goto(link);
    await expect(s.getByRole('heading', { name: 'Imran Qureshi', level: 1 })).toBeVisible();
    await expect(
      s.frameLocator('iframe[data-active]').locator('.cv-page h1').first(),
    ).toContainText('Imran');
    await expect(s.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const axe = await new AxeBuilder({ page: s }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      [],
    );
    // Strangers cannot list or change links.
    expect((await s.request.get('/api/shares')).status()).toBe(401);
    const token = link.split('/').pop()!;
    expect(
      (await s.request.patch(`/api/shares/${token}`, { data: { enabled: false } })).status(),
    ).toBe(401);

    await page.reload();
    await expect(page.getByTestId('share-views')).toContainText('Opened once');

    // Off: the address stops working; on again: the same address works.
    await page.getByTestId('share-panel').getByLabel('Link is on').uncheck();
    await expect(page.getByText('Link switched off')).toBeVisible();
    expect((await s.goto(link))?.status()).toBe(404);
    await page.getByTestId('share-panel').getByLabel('Link is on').check();
    await expect(page.getByText('Link switched on')).toBeVisible();
    expect((await s.goto(link))?.status()).toBe(200);

    // Deleting the CV deletes its link.
    expect((await page.request.delete(`/api/documents/${driver.id}`)).ok()).toBe(true);
    expect((await s.goto(link))?.status()).toBe(404);
    expect((await s.goto('/s/not-a-real-token-123456789'))?.status()).toBe(404);
    await stranger.close();
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('has no share panel and cannot create links', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto(`/cv/${driver.id}/download`);
    await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeVisible();
    await expect(page.getByTestId('share-panel')).toHaveCount(0);
    expect((await page.request.post('/api/shares', { data: { docId: driver.id } })).status()).toBe(
      401,
    );
  });
});
