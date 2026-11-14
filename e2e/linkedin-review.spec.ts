import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R9.9: LinkedIn review from the LinkedIn "Save to PDF" export (demo AI provider). */
const FIX = join(process.cwd(), 'src/modules/import/__fixtures__');
const EXPORT = {
  name: 'Profile.pdf',
  mimeType: 'application/pdf',
  buffer: readFileSync(join(FIX, 'linkedin-export.pdf')),
};
const NOT_LINKEDIN = {
  name: 'cv.pdf',
  mimeType: 'application/pdf',
  buffer: readFileSync(join(FIX, 'two-column.pdf')),
};

const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
const aiUsed = async (page: Page) =>
  (
    (await (await page.request.get('/api/me/entitlements')).json()) as {
      usage: Record<string, number>;
    }
  ).usage['ai.action'] ?? 0;

test('premium: upload the LinkedIn PDF, get each section reviewed with text to paste', async ({
  page,
}) => {
  await seedDocument(page, driver);
  // From Presence, like a person would.
  await page.goto('/presence');
  await page.getByRole('link', { name: 'Review my profile' }).click();
  await expect(page).toHaveURL(/\/linkedin\?tab=review/);
  await expect(page.getByRole('tab', { name: 'Review my profile' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const form = page.getByTestId('linkedin-review-form');
  await expect(form.getByText('Save to PDF')).toBeVisible();
  expect(await serious(page)).toEqual([]);

  // A PDF that isn't a LinkedIn export is turned away before any AI is used.
  await form.locator('input[type=file]').setInputFiles(NOT_LINKEDIN);
  await form.getByRole('button', { name: 'Review my profile' }).click();
  await expect(form.getByText(/doesn’t look like a LinkedIn profile saved as a PDF/)).toBeVisible();
  expect(await aiUsed(page)).toBe(0);

  // The real export, compared with the CV.
  await form.locator('input[type=file]').setInputFiles(EXPORT);
  await expect(form.getByTestId('linkedin-file')).toHaveText('Profile.pdf');
  await expect(form.getByLabel('Compare with my CV')).not.toHaveValue('');
  await form.getByRole('button', { name: 'Review my profile' }).click();
  const out = page.getByTestId('linkedin-review');
  await expect(out.getByRole('heading', { name: 'Your review' })).toBeVisible();
  await expect(out).toContainText('compared with your CV');
  expect(await aiUsed(page)).toBe(1);

  // Headline first, with the profile's own words and a suggestion within LinkedIn's limit.
  const headline = out.locator('[data-section=headline]');
  await expect(headline).toContainText('Could be better');
  await expect(headline).toContainText('Driver at Swift Logistics');
  await expect(headline.getByLabel('Suggested text — Headline')).toHaveValue(
    /^Driver \| Driving \| Customer Service$/,
  );
  await expect(headline.getByText(/\/ 220 characters/)).toBeVisible();
  // The About suggestion uses the CV.
  await expect(
    out.locator('[data-section=about]').getByLabel('Suggested text — About'),
  ).toHaveValue(/nine years of safe, on-time multi-drop work/);
  // A job with no description is "Missing"; its suggestion comes from the CV's points.
  const city = out.locator('[data-section=experience]').filter({ hasText: 'CityLink Couriers' });
  await expect(city).toContainText('Missing');
  await expect(city.getByRole('textbox')).toHaveValue(/handheld scanner/);
  // A quote the model made up is not shown.
  const edu = out.locator('[data-section=education]');
  await expect(edu).toContainText('Good');
  await expect(edu).not.toContainText('not in the export');
  await expect(out.locator('[data-section=contact]')).toContainText('Profile address');
  // Sections come in profile order.
  const order = await out
    .locator('[data-section]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-section')));
  expect(order.slice(0, 2)).toEqual(['headline', 'about']);
  expect(order.indexOf('contact')).toBe(order.length - 1);
  expect(await serious(page)).toEqual([]);

  // Edits stay after a reload (the review is kept in this browser); Clear removes it.
  await headline
    .getByLabel('Suggested text — Headline')
    .fill('Multi-drop van driver | Route planning');
  await page.reload();
  await expect(
    page.getByTestId('linkedin-review').locator('[data-section=headline]').getByRole('textbox'),
  ).toHaveValue('Multi-drop van driver | Route planning');
  await page.getByRole('button', { name: 'Clear this review' }).click();
  await expect(page.getByTestId('linkedin-review')).toHaveCount(0);

  // The writer is still one tab away.
  await page.getByRole('tab', { name: 'Write from my CV' }).click();
  await expect(page.getByRole('button', { name: 'Write my LinkedIn profile' })).toBeVisible();
  await expect(page).toHaveURL(/\/linkedin$/);

  // Crafted requests: not a PDF, no file, a broken CV.
  const word = await page.request.post('/api/linkedin/review', {
    multipart: {
      file: {
        name: 'x.pdf',
        mimeType: 'application/pdf',
        buffer: readFileSync(join(FIX, 'word-sales.docx')),
      },
    },
  });
  expect(word.status()).toBe(422);
  expect(
    (await page.request.post('/api/linkedin/review', { multipart: { target: 'x' } })).status(),
  ).toBe(400);
  const broken = await page.request.post('/api/linkedin/review', {
    multipart: { file: EXPORT, document: JSON.stringify({ id: 'x' }) },
  });
  expect(broken.status()).toBe(400);
  expect(await aiUsed(page)).toBe(1);
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('sees the Premium offer; the API refuses', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/linkedin?tab=review');
    await expect(page.getByText('The LinkedIn review is part of Premium')).toBeVisible();
    const r = await page.request.post('/api/linkedin/review', { multipart: { file: EXPORT } });
    expect(r.status()).toBe(402);
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in', async ({ page }) => {
    await page.goto('/linkedin?tab=review');
    await expect(page.getByText('Sign in to review your LinkedIn profile')).toBeVisible();
    const r = await page.request.post('/api/linkedin/review', { multipart: { file: EXPORT } });
    expect(r.status()).toBe(401);
  });
});
