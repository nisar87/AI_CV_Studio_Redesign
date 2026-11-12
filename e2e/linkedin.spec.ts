import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R3: LinkedIn profile writer (demo AI provider). */
test('premium: writes headline, About and job texts from the CV; edits are kept', async ({
  page,
}) => {
  await seedDocument(page, driver);
  await page.goto(`/cv/${driver.id}/download`);
  await page.getByRole('link', { name: 'Update your LinkedIn profile from this CV →' }).click();
  await expect(page).toHaveURL(new RegExp(`/linkedin\\?doc=${driver.id}`));
  await page.getByLabel('The kind of role you want next').fill('transport planning');
  await page.getByRole('button', { name: 'Write my LinkedIn profile' }).click();
  const out = page.getByTestId('linkedin-result');
  await expect(out.getByLabel('Headline')).toHaveValue(/^Multi-drop Delivery Driver \| /);
  await expect(out.getByLabel('About')).toHaveValue(/open to transport planning roles/);
  const job = out.getByLabel(/^Multi-drop Van Driver — Swift Logistics/);
  await expect(job).toHaveValue(/I deliver around 120 parcels a day/);
  await expect(out.getByRole('list', { name: 'Skills' })).toContainText('Route planning');
  await expect(out.getByText(/\/ 220 characters/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );
  // The person's edits stay after a reload.
  await out.getByLabel('Headline').fill('Delivery driver moving into transport planning');
  await page.reload();
  await expect(page.getByTestId('linkedin-result').getByLabel('Headline')).toHaveValue(
    'Delivery driver moving into transport planning',
  );
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('sees the Premium offer; the API refuses', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/linkedin');
    await expect(page.getByText('The LinkedIn profile writer is part of Premium')).toBeVisible();
    const r = await page.request.post('/api/ai/linkedin.write', {
      data: { input: { profile: 'NAME: Test\nJ1: Driver — Somewhere (2020 to now)' } },
    });
    expect(r.status()).toBe(402);
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in', async ({ page }) => {
    await page.goto('/linkedin');
    await expect(page.getByText('Sign in to write your LinkedIn profile')).toBeVisible();
  });
});
