import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R8.5: the section library (24 types) and skill levels. */
const preview = (page: import('@playwright/test').Page) =>
  page.locator('iframe[title^="Preview of your CV"]:not([aria-hidden])').contentFrame();

test('find a section type in the library, fill it in, and see it on the page', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Editor form and preview side by side on desktop');
  await seedDocument(page, driver);
  await page.goto(`/cv/${driver.id}`);
  await page.getByRole('button', { name: 'Add a section' }).click();
  const types = page.getByRole('list', { name: 'Section types' });
  expect(await types.getByRole('listitem').count()).toBeGreaterThanOrEqual(18);
  await page.getByLabel('Find a section type').fill('personal');
  await types.getByRole('button', { name: /Personal details/ }).click();
  await page.getByLabel('Detail', { exact: true }).fill('Driving licence');
  await page.getByLabel('Value', { exact: true }).fill('Full UK, categories B and C1');
  await expect(preview(page).getByText('Full UK, categories B and C1')).toBeVisible();

  await page.getByRole('button', { name: 'Add a section' }).click();
  await page.getByLabel('Find a section type').fill('references');
  await types.getByRole('button', { name: /References/ }).click();
  await page.getByLabel('Name', { exact: true }).last().fill('Available on request');
  await expect(preview(page).getByText('Available on request')).toBeVisible();
});

test('skill levels are kept with their skill and survive a reload', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop editor');
  await seedDocument(page, driver);
  await page.goto(`/cv/${driver.id}`);
  const skills = driver.sections.find((s) => s.kind === 'skills')!;
  const first = (skills.items[0] as { keywords: string[] }).keywords[0]!;
  const group = page.getByRole('region', { name: skills.title });
  await group
    .getByRole('button', { name: new RegExp(first) })
    .first()
    .click();
  await page.getByText(/Show a level for each skill/).click();
  await page.getByLabel(`Level for ${first}`).selectOption('5');
  await page.waitForTimeout(800);
  await page.reload();
  await group
    .getByRole('button', { name: new RegExp(first) })
    .first()
    .click();
  await expect(page.getByLabel(`Level for ${first}`)).toHaveValue('5');
});
