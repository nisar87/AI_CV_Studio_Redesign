import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './support/test';

async function axeClean(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious,
    JSON.stringify(
      serious.map((v) => [v.id, v.nodes.slice(0, 3).map((n) => n.target)]),
      null,
      2,
    ),
  ).toEqual([]);
}

const previewFrame = (page: Page) =>
  page.locator('iframe[title^="Preview of your CV"]:not([aria-hidden])').contentFrame();

async function continueStep(page: Page) {
  await page.getByRole('button', { name: /^(Continue|Finish)$/ }).click();
}

test('J1: a delivery driver creates, edits and downloads a CV', async ({ page, isMobile }) => {
  const started = Date.now();
  await page.goto('/start');
  await page.getByRole('button', { name: /Driving & delivery/ }).click();
  await expect(page).toHaveURL(/\/cv\/[\w-]+\/guided$/);
  await expect(page.getByRole('heading', { level: 1, name: 'About you' })).toBeVisible();
  await expect(page.getByText('Step 1 of 6')).toBeVisible();
  await axeClean(page);

  // Name is the only required field.
  await continueStep(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Please add your name' })).toBeVisible();
  await page.getByLabel('Full name').fill('Imran Qureshi');
  await page.getByLabel('Job title you want').fill('Delivery Driver');
  await page.getByLabel('Phone').fill('07700 900123');
  await page.getByLabel('Email').fill('imran@example.com');
  await page.getByLabel('Town or city').fill('Leicester');
  await continueStep(page);

  // Licences
  await page
    .getByRole('textbox', { name: 'Licence or card' })
    .fill('Full UK driving licence (B, C1)');
  await continueStep(page);

  // Work history
  await expect(
    page.getByRole('heading', { level: 1, name: 'Where have you worked?' }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Job title', exact: true }).fill('Multi-drop Van Driver');
  await page.getByLabel('Employer').fill('Swift Logistics');
  await page.getByLabel('Started month').selectOption('04');
  await page.getByLabel('Started year').selectOption('2019');
  await page.getByLabel('I still work here').check();
  await page
    .getByLabel('What did you do?')
    .fill('Delivered around 120 parcels a day\nPlanned routes to meet delivery slots');
  await axeClean(page);
  await continueStep(page);

  // Skills via suggestions
  await page.getByRole('button', { name: 'Safe driving' }).click();
  await page.getByRole('button', { name: 'Route planning' }).click();
  await continueStep(page);

  // Education
  await page
    .getByRole('textbox', { name: 'Qualification' })
    .fill('GCSEs including English and Maths');
  await continueStep(page);

  // Summary → finish
  await page.getByLabel('Your introduction').fill('Reliable delivery driver with a clean licence.');
  await continueStep(page);
  await expect(page).toHaveURL(/\/cv\/[\w-]+\?welcome=1$/);
  await expect(page.getByText('Your CV is ready')).toBeVisible();

  if (isMobile) await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(previewFrame(page).locator('.cv-page h1')).toHaveText('Imran Qureshi');
  await expect(previewFrame(page).getByText('Multi-drop Van Driver')).toBeVisible();
  await expect(previewFrame(page).getByText('Apr 2019 – Present')).toBeVisible();

  // Survives a reload.
  await page.reload();
  if (isMobile) await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(previewFrame(page).locator('.cv-page h1')).toHaveText('Imran Qureshi');
  if (isMobile) await page.getByRole('button', { name: 'Edit', exact: true }).click();

  // Undo / redo.
  const name = page.getByLabel('Full name');
  await name.fill('Imran Q');
  await expect(name).toHaveValue('Imran Q');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(name).toHaveValue('Imran Qureshi');

  // Design change keeps content.
  if (isMobile) await page.getByRole('button', { name: 'Design', exact: true }).click();
  else await page.getByRole('tab', { name: 'Design' }).click();
  await page.getByRole('radio', { name: /Calm & classic/ }).click();
  if (isMobile) await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(previewFrame(page).locator('html[data-template="heritage"]')).toHaveCount(1);
  await expect(previewFrame(page).getByText('Multi-drop Van Driver')).toBeVisible();
  if (!isMobile) await axeClean(page);

  // Download.
  await page.getByRole('link', { name: 'Download' }).click();
  await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeVisible();
  await expect(page.getByTestId('health')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  expect((await download).suggestedFilename()).toBe('Imran-Qureshi-CV.pdf');
  await axeClean(page);

  // Whole journey well under 10 minutes for a scripted user (real users: see docs).
  expect(Date.now() - started).toBeLessThan(10 * 60 * 1000);

  // The CV is listed in My CVs.
  await page.goto('/cv');
  await expect(page.getByRole('heading', { name: 'My CV', exact: true })).toBeVisible();
});

test('PDF failure offers Print as a fallback', async ({ page }) => {
  await page.goto('/cv/new?work=general');
  await page.getByLabel('Full name').fill('Test Person');
  const url = page.url().replace(/\/guided$/, '/download');
  await page.waitForTimeout(600); // autosave
  await page.route('**/api/pdf', (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: 'RENDER_FAILED', message: 'We couldn’t create the PDF just now.' } },
    }),
  );
  await page.goto(url);
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'We couldn’t create the PDF' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();
});

test('sections can be reordered with buttons and hidden', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Covered on desktop');
  await page.goto('/cv/new?work=teacher');
  await page.getByLabel('Full name').fill('Grace Mensah');
  await page.waitForTimeout(600);
  await page.goto(page.url().replace(/\/guided$/, ''));
  const headings = page.locator('section[data-section] h3');
  await expect(headings.first()).toHaveText('Work history');
  await page.getByRole('button', { name: 'Move “Education” up' }).click();
  await expect(headings.first()).toHaveText('Education');
  await page.getByRole('button', { name: 'More options for “Skills”' }).click();
  await page.getByRole('menuitem', { name: 'Hide from CV' }).click();
  await expect(page.getByText('(hidden from CV)')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByText('(hidden from CV)')).toHaveCount(0);
});

test('unknown CV ids show a friendly message', async ({ page }) => {
  await page.goto('/cv/does-not-exist');
  await expect(page.getByRole('heading', { name: 'We can’t find this CV' })).toBeVisible();
});

test('a photo can be added, shown in photo designs, hidden, and removed', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Covered on desktop');
  const { SAMPLE_PHOTOS } = await import('../src/modules/resume/fixture-photos');
  await page.goto('/cv/new?work=teacher');
  await page.getByLabel('Full name').fill('Grace Mensah');
  const buffer = Buffer.from(SAMPLE_PHOTOS.a.split(',')[1]!, 'base64');
  await page
    .locator('input[type="file"][accept^="image"]')
    .setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer });
  await expect(page.getByRole('img', { name: 'Your photo' })).toBeVisible();
  await expect(previewFrame(page).locator('.cv-page .cv-portrait img')).toHaveCount(1);

  await page.goto(page.url().replace(/\/guided$/, ''));
  await page.getByRole('tab', { name: 'Design' }).click();
  await page.getByRole('checkbox', { name: 'Show my photo' }).uncheck();
  await expect(previewFrame(page).locator('.cv-page .cv-portrait img')).toHaveCount(0);
  // A design without photo support explains itself instead of failing silently.
  await page.getByRole('radio', { name: /Calm & classic/ }).click();
  await expect(previewFrame(page).locator('html[data-template="heritage"]')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Content' }).click();
  await expect(page.getByText('This design doesn’t show photos')).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).first().click();
  await expect(page.getByRole('img', { name: 'Your photo' })).toHaveCount(0);
});

test('the design picker offers all ten designs with thumbnails', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Covered on desktop');
  await page.goto('/cv/new?work=driver');
  await page.getByLabel('Full name').fill('Imran Qureshi');
  await page.waitForTimeout(600);
  await page.goto(page.url().replace(/\/guided$/, ''));
  await page.getByRole('tab', { name: 'Design' }).click();
  const options = page.getByRole('radiogroup', { name: 'Design' }).getByRole('radio');
  await expect(options).toHaveCount(10);
  for (const name of [
    'Creative sidebar',
    'Bold editorial',
    'Timeline',
    'Bold & modern',
    'Warm portrait',
    'Editorial',
    'Friendly & fresh',
  ]) {
    await page.getByRole('radio', { name: new RegExp(name) }).click();
    await expect(page.getByRole('radio', { name: new RegExp(name) })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  }
  await expect(previewFrame(page).locator('html[data-template="sprout"]')).toHaveCount(1);
  await expect(previewFrame(page).locator('.cv-page h1')).toHaveText('Imran Qureshi');
  const broken = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll<HTMLImageElement>('img[src^="/templates/"]')).filter(
        (i) => !i.complete || i.naturalWidth === 0,
      ).length,
  );
  expect(broken).toBe(0);
});

test('undo back to an earlier design updates the preview again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Covered on desktop');
  await page.goto('/cv/new?work=driver');
  await page.getByLabel('Full name').fill('Imran Qureshi');
  await page.waitForTimeout(600);
  await page.goto(page.url().replace(/\/guided$/, ''));
  await page.getByRole('tab', { name: 'Design' }).click();
  await expect(previewFrame(page).locator('html[data-template="clarity"]')).toHaveCount(1);
  await page.getByRole('radio', { name: /Bold & modern/ }).click();
  await expect(previewFrame(page).locator('html[data-template="vivid"]')).toHaveCount(1);
  // The previous document is still loaded in the hidden frame; undo must show it again.
  await page.keyboard.press('Control+z');
  await expect(previewFrame(page).locator('html[data-template="clarity"]')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(previewFrame(page).locator('html[data-template="vivid"]')).toHaveCount(1);
});
