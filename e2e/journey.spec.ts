import { join } from 'node:path';
import { expect, test } from './support/test';

/**
 * R8 acceptance (complete-studio-spec §16): a new user goes from uploading their CV to a tailored
 * application kit for a pasted job in under 10 minutes, and every studio destination has something
 * to do for a new account.
 */
const FIX = join(process.cwd(), 'src/modules/import/__fixtures__');
const ADVERT = [
  'Sales Executive, Lahore.',
  'You will build relationships with retail customers, meet monthly sales targets and report to the regional manager.',
  'Essential: two years of field sales experience and good spoken English.',
].join('\n');

test('upload → studio → job → application kit in under 10 minutes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'One run of the journey is enough');
  const started = Date.now();
  await page.goto('/studio');
  await expect(page.getByTestId('next-action')).toHaveAttribute('data-action', 'upload');
  await page.getByTestId('next-action').getByRole('link').click();
  await expect(page).toHaveURL(/\/makeover$/);
  await page.getByTestId('makeover-file').setInputFiles(join(FIX, 'word-sales.docx'));
  await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('makeover-edit').click();
  await expect(page).toHaveURL(/\/cv\/[\w-]+$/);

  // Home now suggests adding a job.
  await page.goto('/studio');
  await expect(page.getByTestId('next-action')).toHaveAttribute('data-action', 'add-job');
  await page.getByTestId('next-action').getByRole('link').click();
  const form = page.getByRole('form', { name: 'Add a job' });
  await form.getByLabel('Job title').fill('Sales Executive');
  await form.getByLabel('Company').fill('Bright Retail');
  await form.getByLabel('The job advert').fill(ADVERT);
  await form.getByRole('button', { name: 'Save job' }).click();
  await page.getByRole('link', { name: 'Sales Executive' }).click();

  const kit = page.getByTestId('kit');
  await kit.getByRole('button', { name: 'Create the kit' }).click();
  await expect(kit.getByText('Tailored CV', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(kit).toContainText('Application: Sales Executive');
  const minutes = (Date.now() - started) / 60_000;
  expect(minutes).toBeLessThan(10);
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('every destination has something to do for a new account', async ({ page }) => {
    const checks: [string, RegExp][] = [
      ['/studio', /Upload my CV/],
      ['/documents', /New CV/],
      ['/jobs', /Add a job/],
      ['/presence', /Set up my page/],
      ['/coach', /Add a job/],
    ];
    for (const [path, action] of checks) {
      await page.goto(path);
      await expect(
        page
          .locator('main')
          .getByRole('link', { name: action })
          .or(page.locator('main').getByRole('button', { name: action }))
          .first(),
        path,
      ).toBeVisible();
    }
  });
});
