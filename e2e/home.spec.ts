import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R8.1: the signed-in studio shell and Studio Home (complete-studio-spec §11.1–11.2). */

test('a new account gets the studio shell and is told to upload a CV', async ({
  page,
  isMobile,
}) => {
  await page.goto('/studio');
  await expect(page.locator('[data-shell="studio"]')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  for (const name of ['Home', 'Documents', 'Jobs', 'Presence', 'Coach'])
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByTestId('next-action')).toHaveAttribute('data-action', 'upload');
  await expect(page.getByRole('link', { name: 'Upload my CV' })).toHaveAttribute(
    'href',
    '/makeover',
  );
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // The Create sheet offers every way to start.
  await page.getByRole('button', { name: 'Create' }).filter({ visible: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Create' });
  await expect(sheet).toBeVisible();
  for (const name of [/Upload a CV/, /New CV/, /Cover letter/, /Add a job/, /Portfolio/])
    await expect(sheet.getByRole('link', { name })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  if (!isMobile) {
    // Ctrl+K jumps anywhere.
    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox', { name: 'Search or jump to' });
    await expect(box).toBeFocused();
    await box.fill('coach');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/coach$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Coach' })).toBeVisible();
  }
});

test('with a CV: continue card, documents row, profile nudge, and next step moves on', async ({
  page,
}) => {
  await seedDocument(page, driver);
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'Continue' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue editing' })).toHaveAttribute(
    'href',
    `/cv/${driver.id}`,
  );
  // No jobs yet → add a job.
  await expect(page.getByTestId('next-action')).toHaveAttribute('data-action', 'add-job');
  await page.getByTestId('next-action').getByRole('link').click();
  await expect(page).toHaveURL(/\/jobs\?new=1/);
  await expect(page.getByRole('form', { name: 'Add a job' })).toBeVisible();
});

test('documents and presence are in the shell; the editor keeps its own bar', async ({ page }) => {
  await seedDocument(page, driver);
  await page.goto('/documents');
  await expect(page.getByRole('heading', { level: 1, name: 'Documents' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  await expect(nav.getByRole('link', { name: 'Documents', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.goto('/presence');
  await expect(page.getByRole('heading', { name: 'Portfolio page' })).toBeVisible();
  await page.goto(`/cv/${driver.id}`);
  await expect(page.locator('[data-shell="studio"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to Documents' })).toBeVisible();
});

test.describe('free account coach', () => {
  test.use({ as: 'free' });
  test('Coach is never empty: it points to adding a job', async ({ page }) => {
    await page.goto('/coach');
    await expect(page.getByText('Add a job you want to start practising')).toBeVisible();
  });
});
