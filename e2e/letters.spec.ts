import AxeBuilder from '@axe-core/playwright';
import { request as pwRequest } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expect, test } from './support/test';
import { apiSignUp } from './support/auth';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R8.2: letter library and the Documents hub. */

test.describe('free account', () => {
  test.use({ as: 'free' });

  test('write a resignation letter yourself, preview it in the CV design, download, find it in Documents, delete', async ({
    page,
  }) => {
    await seedDocument(page, driver);
    await page.goto('/documents?type=letters');
    await expect(page.getByText('No letters yet. Pick one to start:')).toBeVisible();
    await page
      .getByRole('list', { name: 'Start a letter' })
      .getByRole('link', { name: 'Resignation letter' })
      .click();
    await expect(page).toHaveURL(/\/letters\/new\?type=resignation/);
    const form = page.getByRole('form', { name: 'Resignation letter' });

    // Required answers are checked before anything is created.
    await form.getByRole('button', { name: 'Write it myself' }).click();
    await expect(page.getByText('Answer “Your current role” to continue.')).toBeVisible();
    // AI drafts are Premium.
    await expect(form.getByRole('button', { name: 'Write it with AI' })).toBeDisabled();

    await form.getByLabel('Your current role').fill('Van Driver');
    await form.getByLabel('Organisation').fill('Swift Logistics');
    await form.getByLabel('Your last working day').fill('31 December 2026');
    await form.getByLabel('Who it’s to').fill('Sara Khan\nSwift Logistics');
    await form.getByRole('button', { name: 'Write it myself' }).click();

    await expect(page).toHaveURL(/\/letters\/[\w-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Resignation' })).toBeVisible();
    const preview = page.frameLocator('iframe[title="Letter preview"]');
    await expect(preview.getByText('Imran Qureshi').first()).toBeVisible();
    await expect(preview.getByText(/My last working day will be 31 December 2026/)).toBeVisible();
    await expect(preview.getByText('Sara Khan')).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      [],
    );

    // Edit, save, and the preview follows.
    await page.getByLabel('Greeting').fill('Dear Sara,');
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
    await page.getByRole('button', { name: 'Save letter' }).click();
    await expect(page.getByText('Letter saved')).toBeVisible();
    await expect(preview.getByText('Dear Sara,')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PDF' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('Imran-Qureshi-Resignation-letter.pdf');
    expect(
      readFileSync(await download.path())
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');

    // Reload keeps it (it lives in the account).
    await page.reload();
    await expect(page.getByLabel('Greeting')).toHaveValue('Dear Sara,');

    // It's listed in Documents → Letters.
    await page.getByRole('link', { name: 'Your letters' }).click();
    await expect(page).toHaveURL(/\/documents\?type=letters/);
    const list = page.getByRole('list', { name: 'Letters' });
    await expect(list.getByRole('link', { name: /Resignation/ })).toBeVisible();

    // Delete.
    await list.getByRole('link', { name: /Resignation/ }).click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/documents\?type=letters/);
    await expect(page.getByText('No letters yet. Pick one to start:')).toBeVisible();
  });

  test('the AI draft API is Premium; letters are private to their owner', async ({
    request,
    baseURL,
  }) => {
    const created = await request.post('/api/letters', {
      data: {
        type: 'thank-you',
        answers: { role: 'Nurse', organisation: 'City Hospital' },
        paragraphs: ['Thank you.'],
      },
    });
    expect(created.ok()).toBe(true);
    const { letter } = (await created.json()) as { letter: { id: string } };
    const draft = await request.post(`/api/letters/${letter.id}/draft`, {
      data: { document: driver, tone: 'warm' },
    });
    expect(draft.status()).toBe(402);

    // Someone else can't read, change or delete it.
    const other = await pwRequest.newContext({ baseURL });
    await apiSignUp(other);
    expect((await other.get(`/api/letters/${letter.id}`)).status()).toBe(404);
    expect(
      (await other.put(`/api/letters/${letter.id}`, { data: { subject: 'x' } })).status(),
    ).toBe(404);
    expect((await other.delete(`/api/letters/${letter.id}`)).status()).toBe(404);
    expect(
      ((await (await other.get('/api/letters')).json()) as { letters: unknown[] }).letters,
    ).toEqual([]);
    await other.dispose();

    // Bad input is refused.
    expect((await request.post('/api/letters', { data: { type: 'ransom' } })).status()).toBe(400);
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in, and the API refuses', async ({ page }) => {
    await page.goto('/letters/new?type=resignation');
    await expect(
      page.getByRole('heading', { name: 'Sign in to write and keep letters' }),
    ).toBeVisible();
    expect((await page.request.get('/api/letters')).status()).toBe(401);
    expect(
      (await page.request.post('/api/letters', { data: { type: 'resignation' } })).status(),
    ).toBe(401);
  });
});

test('Premium: a general cover letter drafted with AI uses the answers and the CV', async ({
  page,
}) => {
  await seedDocument(page, driver);
  await page.goto('/documents');
  await page.getByRole('button', { name: 'Create' }).filter({ visible: true }).click();
  await page
    .getByRole('dialog', { name: 'Create' })
    .getByRole('link', { name: /Cover letter/ })
    .click();
  await expect(page).toHaveURL(/\/letters\/new\?type=cover/);
  const form = page.getByRole('form', { name: 'Cover letter' });
  await form.getByLabel('The role you’re applying for').fill('Delivery Driver');
  await form.getByLabel('Organisation (if you know it)').fill('Parcel Express');
  await form.getByRole('button', { name: 'Write it with AI' }).click();
  await expect(page).toHaveURL(/\/letters\/[\w-]+$/, { timeout: 30_000 });
  await expect(page.getByLabel('Paragraph 1')).toHaveValue(/Delivery Driver/);
  const preview = page.frameLocator('iframe[title="Letter preview"]');
  await expect(preview.getByText(/Application: Delivery Driver/)).toBeVisible();

  // A new draft from changed answers.
  await page.getByText('Your answers and a new AI draft').click();
  await page.getByLabel('Organisation (if you know it)').fill('Swift Couriers');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Write a new AI draft' }).click();
  await expect(page.getByLabel('Paragraph 1')).toHaveValue(/Swift Couriers/);

  // Filter Documents to letters.
  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'CVs' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Letters' }).getByRole('link')).toHaveCount(1);
  await page.getByRole('link', { name: 'Letters', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CVs' })).toHaveCount(0);
});
