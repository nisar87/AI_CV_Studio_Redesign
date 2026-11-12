import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import { expect, test } from './support/test';

/** R1.5 — import an existing CV (PDF/DOCX) into editable sections. */
const FIX = join(process.cwd(), 'src/modules/import/__fixtures__');

async function usage(page: Page) {
  const e = (await (await page.request.get('/api/me/entitlements')).json()) as {
    usage: Record<string, number>;
  };
  return e.usage['import.cv'];
}

async function noSeriousA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
}

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in, and the API refuses', async ({ page }) => {
    await page.goto('/cv/import');
    await expect(page.getByRole('heading', { name: 'Sign in to import your CV' })).toBeVisible();
    const r = await page.request.post('/api/import', {
      multipart: {
        file: { name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
      },
    });
    expect(r.status()).toBe(401);
  });
});

test.describe('free account', () => {
  test.use({ as: 'free' });

  test('imports a Word CV, shows it in a chosen design and opens it in the editor', async ({
    page,
  }) => {
    await page.goto('/start');
    await page.getByRole('link', { name: /Already have a CV/ }).click();
    await expect(page.getByTestId('imports-left')).toContainText('2 of 2 imports left');
    await noSeriousA11y(page);

    await page.getByTestId('cv-file').setInputFiles(join(FIX, 'word-sales.docx'));
    await expect(page.getByTestId('import-done')).toBeVisible();
    const report = page.getByTestId('import-report');
    await expect(report).toContainText('Your name, contact details and a profile');
    await expect(report).toContainText('Work experience: 2 jobs');
    await expect(report).toContainText('Education: 2 qualifications');
    await expect(report).toContainText('Languages: 3 languages');
    expect(await usage(page)).toBe(1);

    await page.getByRole('radio', { name: 'Chronicle' }).click();
    await expect(page.getByRole('radio', { name: 'Chronicle' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await noSeriousA11y(page);

    await page.getByRole('button', { name: 'Open in the editor' }).click();
    await expect(page).toHaveURL(/\/cv\/[\w-]+$/);
    await expect(page.getByLabel('Full name')).toHaveValue('Ahmed Raza Khan');
    await expect(page.getByLabel('Email')).toHaveValue('ahmed.raza@example.com');

    await page.goto('/cv');
    await expect(page.getByRole('heading', { name: 'Ahmed Raza Khan — imported' })).toBeVisible();
  });

  test('imports a two-column PDF', async ({ page }) => {
    await page.goto('/cv/import');
    await page.getByTestId('cv-file').setInputFiles(join(FIX, 'two-column.pdf'));
    await expect(page.getByTestId('import-report')).toContainText('Work experience: 6 jobs');
  });

  test('a file it cannot read is explained and not counted', async ({ page }) => {
    await page.goto('/cv/import');
    await page.getByTestId('cv-file').setInputFiles({
      name: 'cv.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('GIF89a not really a pdf'),
    });
    await expect(page.getByTestId('import-error')).toContainText('Please choose a PDF or a Word');
    await page.getByTestId('cv-file').setInputFiles({
      name: 'old.doc',
      mimeType: 'application/msword',
      buffer: Buffer.from('x'),
    });
    await expect(page.getByTestId('import-error')).toContainText('older Word file');
    expect(await usage(page)).toBe(0);
  });

  test('the monthly allowance is enforced by the server', async ({ page }) => {
    const file = {
      name: 'cv.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: (await import('node:fs')).readFileSync(join(FIX, 'word-sales.docx')),
    };
    for (let i = 0; i < 2; i++)
      expect((await page.request.post('/api/import', { multipart: { file } })).status()).toBe(200);
    const third = await page.request.post('/api/import', { multipart: { file } });
    expect(third.status()).toBe(402);
    await page.goto('/cv/import');
    await expect(page.getByText('You’ve used all 2 imports for this month.')).toBeVisible();
  });
});
