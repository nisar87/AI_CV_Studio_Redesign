import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PASSWORD, uniqueEmail } from './support/auth';
import { expect, test } from './support/test';

/** R5 — Instant Makeover (spec §6): upload any CV, see it transformed, polish, save. */
const FIX = join(process.cwd(), 'src/modules/import/__fixtures__');
const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  jpg: 'image/jpeg',
  png: 'image/png',
};
const fixture = (name: string) => ({
  name,
  mimeType: MIME[name.split('.').pop()!]!,
  buffer: readFileSync(join(FIX, name)),
});

const SINGLE = ['clarity', 'chronicle', 'heritage', 'ledger'];
const SIDEBAR = ['meridian', 'atelier', 'folio', 'halo', 'sprout', 'vivid'];
const BOLD = ['meridian', 'atelier', 'ledger', 'vivid', 'sprout'];

type MakeoverJson = {
  makeoverId: string;
  mode: 'full' | 'preview';
  previewFor: string | null;
  scanned: boolean;
  method: string;
  document: { basics: { name: string; email: string } };
  coverage: { ratio: number; missing: string[] };
  ranking: { id: string }[];
  counts: Record<string, number>;
  profile: { presetId: string };
};

async function makeover(request: APIRequestContext, name: string) {
  return request.post('/api/makeover', { multipart: { file: fixture(name) } });
}

async function usage(page: Page) {
  const e = (await (await page.request.get('/api/me/entitlements')).json()) as {
    usage: Record<string, number>;
  };
  return e.usage['import.cv'];
}

async function noSeriousA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
}

test.describe('visitor', () => {
  test.use({ as: 'visitor' });

  test('drops a CV on the home page and sees it transformed, with six different designs', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('makeover-file').setInputFiles(join(FIX, 'word-sales.pdf'));
    await expect(page).toHaveURL(/\/makeover$/);
    await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 30_000 });

    const options = page.getByTestId('design-option');
    await expect(options).toHaveCount(6);
    const ids = await options.evaluateAll((els) => els.map((e) => e.getAttribute('data-design')!));
    expect(ids.some((id) => SINGLE.includes(id))).toBe(true);
    expect(ids.some((id) => SIDEBAR.includes(id))).toBe(true);
    expect(ids.some((id) => BOLD.includes(id))).toBe(true);
    // The first (pre-selected) design is a free one for a visitor.
    await expect(options.first()).toHaveAttribute('aria-checked', 'true');

    // Before/after: the original PDF page sits under the new CV, revealed by the slider.
    await expect(page.getByTestId('compare-slider')).toBeVisible();
    await expect(page.getByTestId('before-layer')).toBeVisible();
    await page.getByTestId('compare-slider').fill('100');
    await expect(page.getByTestId('before-layer')).toHaveCount(0);

    await options.nth(2).click();
    await expect(options.nth(2)).toHaveAttribute('aria-checked', 'true');
    await expect(options.first()).toHaveAttribute('aria-checked', 'false');
    await noSeriousA11y(page);

    // Download asks a visitor to sign up (the result is kept).
    await page.getByTestId('makeover-download').click();
    await expect(page).toHaveURL(/\/signin\?mode=signup&next=%2Fmakeover%3Fresume%3D1/);
  });

  test('a makeover survives sign-up and appears in the account on another device', async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, 'Covered on desktop');
    await page.goto('/makeover');
    await page.getByTestId('makeover-file').setInputFiles(join(FIX, 'word-sales.docx'));
    await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('design-option').nth(1).click();
    const chosen = await page.getByTestId('design-option').nth(1).getAttribute('data-design');
    await page.getByTestId('makeover-edit').click();

    const email = uniqueEmail('makeover');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByLabel('I am 18 or older and agree to the terms and privacy notice').check();
    await page.getByRole('button', { name: 'Create account' }).click();

    // Back on /makeover, the save carries on by itself and opens the editor.
    await expect(page).toHaveURL(/\/cv\/[\w-]+$/, { timeout: 20_000 });
    await expect(page.getByLabel('Full name')).toHaveValue('Ahmed Raza Khan');
    expect(await usage(page)).toBe(1);
    await expect
      .poll(async () => (await (await page.request.get('/api/documents')).json()).documents.length)
      .toBe(1);

    const other = await browser.newContext();
    const b = await other.newPage();
    await b.goto('/signin?next=/cv');
    await b.getByLabel('Email').fill(email);
    await b.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await b.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(b.getByRole('heading', { name: 'Ahmed Raza Khan — imported' })).toBeVisible({
      timeout: 20_000,
    });
    const docs = (await (await b.request.get('/api/documents')).json()).documents as {
      id: string;
    }[];
    const saved = await (await b.request.get(`/api/documents/${docs[0]!.id}`)).json();
    expect(saved.doc.design.templateId).toBe(chosen);
    await other.close();
  });

  test('a file it cannot read is explained, and the drop zone stays ready', async ({ page }) => {
    await page.goto('/makeover');
    await page.getByTestId('makeover-file').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    await expect(page.getByTestId('drop-error')).toContainText('Please choose a PDF, a Word file');
    await page.getByTestId('makeover-file').setInputFiles({
      name: 'cv.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('GIF89a not really a pdf'),
    });
    await expect(page.getByRole('alert').filter({ hasText: 'Please choose a PDF' })).toBeVisible();
    await expect(page.getByTestId('drop-zone')).toBeVisible();
  });

  test('crafted requests cannot claim, polish or reach internal AI tasks', async ({ request }) => {
    const fake = '00000000-0000-4000-8000-000000000000';
    expect(
      (await request.post('/api/makeover/claim', { data: { makeoverId: fake } })).status(),
    ).toBe(401);
    const polish = await request.post('/api/makeover/polish', {
      data: {
        makeoverId: fake,
        input: {
          chip: 'wording',
          presetId: 'retail',
          items: [{ id: 'summary', text: 'hi there' }],
        },
      },
    });
    expect(polish.status()).toBe(404);
    for (const task of ['makeover.diagnose', 'import.transcribe', 'import.structure'])
      expect((await request.post(`/api/ai/${task}`, { data: { input: {} } })).status()).toBe(400);
    expect(
      (await request.post('/api/metrics/event', { data: { name: 'landing_view' } })).status(),
    ).toBe(204);
    expect((await request.post('/api/metrics/event', { data: { name: 'pdf_ok' } })).status()).toBe(
      400,
    );
  });
});

test.describe('free account', () => {
  test.use({ as: 'free' });

  test('a photo of a CV says it was read from an image', async ({ page }) => {
    await page.goto('/makeover');
    await page.getByTestId('makeover-file').setInputFiles(join(FIX, 'scan-photo.png'));
    await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Please check names and numbers')).toBeVisible();
    await expect(page.getByTestId('before-layer')).toBeVisible();
  });

  test('saving counts one import; over the allowance it is a watermarked preview', async ({
    page,
  }) => {
    await page.goto('/makeover');
    await page.getByTestId('makeover-file').setInputFiles(join(FIX, 'word-sales.docx'));
    await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('watermark')).toHaveCount(0);
    expect(await usage(page)).toBe(1);
    await page.getByTestId('makeover-edit').click();
    await expect(page).toHaveURL(/\/cv\/[\w-]+$/);
    await expect(page.getByLabel('Full name')).toHaveValue('Ahmed Raza Khan');
    expect(await usage(page)).toBe(1);

    // Use the second import, then the next is a preview (once a day).
    expect((await makeover(page.request, 'word-sales.docx')).status()).toBe(200);
    await page.goto('/makeover');
    await page.getByTestId('makeover-file').setInputFiles(join(FIX, 'word-sales.docx'));
    await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('watermark')).toBeVisible();
    await expect(page.getByText('This is a preview')).toBeVisible();
    await page.getByTestId('makeover-edit').click();
    await expect(page.getByRole('alert').filter({ hasText: /imports/ })).toBeVisible();
    await expect(page).toHaveURL(/\/makeover$/);
    expect(await usage(page)).toBe(2);

    const fourth = await makeover(page.request, 'word-sales.docx');
    expect(fourth.status()).toBe(402);
  });

  test('polish: wording is free once, invented facts are never shown, bullets need Premium', async ({
    page,
  }) => {
    await page.goto('/makeover');
    await page.getByTestId('makeover-file').setInputFiles(join(FIX, 'polish.docx'));
    await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 30_000 });
    const wording = page.getByTestId('chip-wording');
    await expect(wording).toContainText(/Fix \d+ wording issues?/);
    await wording.click();
    await page.getByRole('button', { name: 'Show suggestions' }).click();
    const list = page.getByTestId('polish-list');
    await expect(list).toBeVisible();
    await expect(list).toContainText('Served customers at the till every day');
    // The test model adds "45%" to the ZZ-INVENT line; the truth guard drops that suggestion.
    await expect(list).not.toContainText('45%');
    await list.getByRole('button', { name: 'Accept all' }).click();
    await expect(list).toContainText('All done');

    await page.getByTestId('chip-bullets').click();
    await page.getByRole('button', { name: 'Show suggestions' }).click();
    await expect(page.getByTestId('polish-denied')).toBeVisible();

    // Accepted wording is what gets saved.
    await page.getByTestId('makeover-edit').click();
    await expect(page).toHaveURL(/\/cv\/[\w-]+$/);
    await expect
      .poll(async () => {
        const docs = (await (await page.request.get('/api/documents')).json()).documents as {
          id: string;
        }[];
        if (!docs[0]) return '';
        const d = await (await page.request.get(`/api/documents/${docs[0].id}`)).json();
        return JSON.stringify(d.doc?.sections ?? '');
      })
      .toContain('Served customers at the till every day');
  });
});

test.describe('premium account', () => {
  test('Word, old Word, scanned PDF and photos are all read, with full coverage', async ({
    request,
  }) => {
    for (const name of ['word-sales.docx', 'word-sales.doc', 'scanned.pdf', 'scan-photo.jpg']) {
      const r = await makeover(request, name);
      expect(r.status(), name).toBe(200);
      const j = (await r.json()) as MakeoverJson;
      expect(j.document.basics.name, name).toBe('Ahmed Raza Khan');
      expect(j.document.basics.email, name).toBe('ahmed.raza@example.com');
      expect(j.coverage.ratio, name).toBeGreaterThanOrEqual(0.97);
      expect(j.scanned, name).toBe(/scan/.test(name));
      expect(j.ranking, name).toHaveLength(6);
      expect(j.profile.presetId, name).toBe('office');
    }
  });

  test('can strengthen bullets', async ({ page }) => {
    await page.goto('/makeover');
    await page.getByTestId('makeover-file').setInputFiles(join(FIX, 'polish.docx'));
    await expect(page.getByTestId('makeover-done')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('chip-bullets').click();
    await page.getByRole('button', { name: 'Show suggestions' }).click();
    const list = page.getByTestId('polish-list');
    await expect(list).toBeVisible();
    await expect(list).not.toContainText('45%');
    await expect(list.getByTestId('suggestion').first()).toBeVisible();
  });
});
