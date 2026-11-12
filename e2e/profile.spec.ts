import { join } from 'node:path';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R2: career profile (master record) → CVs made from it. */
test.use({ as: 'free' });

test('set up the profile from a CV, then make a new CV from it', async ({ page }) => {
  await seedDocument(page, driver);
  await page.goto('/cv');
  const card = page.getByTestId('profile-card');
  await card.getByRole('link', { name: 'Set up your profile' }).click();
  await expect(page.getByRole('heading', { name: 'Your career profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Use this' }).first().click();
  await expect(page.getByText('This is your career profile')).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue('Imran Qureshi');

  await page.goto('/cv');
  await expect(card).toContainText('Your master record');
  // The profile isn't listed among the CVs.
  await expect(page.getByRole('heading', { name: 'Career profile', exact: true })).toHaveCount(1);
  await card.getByRole('button', { name: 'New CV from profile' }).click();
  await expect(page).toHaveURL(/\/cv\/[\w-]+$/);
  await expect(page.getByText('This is your career profile')).toHaveCount(0);
  await expect(page.getByLabel('Full name')).toHaveValue('Imran Qureshi');
  await page.goto('/cv');
  await expect(page.getByRole('heading', { name: 'Imran Qureshi — CV' })).toBeVisible();

  // Visiting /profile now opens the existing profile.
  await page.goto('/profile');
  await expect(page.getByText('This is your career profile')).toBeVisible();
});

test('an imported CV can become the career profile', async ({ page }) => {
  await page.goto('/makeover');
  await page
    .getByTestId('makeover-file')
    .setInputFiles(join(process.cwd(), 'src/modules/import/__fixtures__/word-sales.docx'));
  await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Use this as my career profile/).check();
  await page.getByTestId('makeover-edit').click();
  await expect(page.getByText('This is your career profile')).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue('Ahmed Raza Khan');
});
