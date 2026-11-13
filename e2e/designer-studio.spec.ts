import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { setConfig } from './support/auth';
import { DEFAULT_CONFIG } from '../src/modules/billing/config';
import { FIXTURES } from '../src/modules/resume/fixtures';
import type { ResumeDocument } from '../src/modules/resume/schema';

/**
 * R7 "Describe your design" (complete-studio-spec §7.4, §7.7, §7.8) with the mock AI: compose
 * three live designs from words or a picture, use one, refine it in words (only named fields
 * change), the free taste and the gates; and the 32-design picker. Runs in the admin project
 * (it changes site-wide switches).
 */
const ON = {
  ...DEFAULT_CONFIG,
  features: { ...DEFAULT_CONFIG.features, designStudio: true, designer: true },
};

async function config(request: APIRequestContext, value = ON) {
  await setConfig(request, value);
}

async function openDesign(page: Page, doc: ResumeDocument) {
  await seedDocument(page, doc);
  await page.goto(`/cv/${doc.id}`);
  await page.getByRole('tab', { name: 'Design' }).click();
}

/** data-template of the visible preview document. */
const previewTemplate = (page: Page) =>
  page
    // The main preview (candidate previews are titled "… design preview").
    .frameLocator('iframe[data-active][title^="Preview of your CV"]')
    .first()
    .locator('html[data-cv-ready]')
    .getAttribute('data-template', { timeout: 10_000 })
    .catch(() => null);

test.afterAll(async ({ request }) => {
  await config(request, DEFAULT_CONFIG);
});

test('describe → three live designs → use one → refine in words → undo', async ({
  page,
  request,
}) => {
  await config(request, { ...ON, features: { ...ON.features, designer: false } });
  const doc = { ...structuredClone(FIXTURES.engineer), id: 'designer-1' };
  await openDesign(page, doc);
  await expect(page.getByTestId('designer')).toHaveCount(0);

  await config(request);
  await page.reload();
  await page.getByRole('tab', { name: 'Design' }).click();
  const designer = page.getByTestId('designer');
  await expect(designer).toBeVisible();
  await designer.getByLabel('Describe the CV you imagine').fill('2 column, navy, square bullets');
  await designer.getByRole('button', { name: 'Design it' }).click();

  const cards = designer.getByTestId('designer-candidate');
  await expect(cards).toHaveCount(3);
  // Each candidate is a live preview of this CV that laid out without overflow.
  for (let i = 0; i < 3; i++)
    await expect(cards.nth(i)).toHaveAttribute('data-ready', '', { timeout: 20_000 });
  await expect(cards.first()).toContainText('Closest');

  await cards
    .first()
    .getByRole('button', { name: /Use the .* design/ })
    .click();
  await expect(page.getByTestId('designer-note')).toContainText('Now using');
  await expect.poll(() => previewTemplate(page)).toBe('custom');
  await expect(page.getByTestId('studio-base')).toContainText(
    'Your own design, started from Harbor',
  );

  // Refine: one named change; an impossible one changes nothing and says why.
  await designer.getByLabel('Change something about this design').fill('make the sidebar narrower');
  await designer.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page.getByTestId('designer-note')).toContainText('only what you asked');
  await designer.getByLabel('Change something about this design').fill('four columns please');
  await designer.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page.getByTestId('designer-note')).toContainText('three columns');

  // Undo walks back: refine, then the chosen design (focus out of the text box first).
  await designer.getByRole('heading', { name: 'Describe the CV you imagine' }).click();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect.poll(() => previewTemplate(page)).not.toBe('custom');

  const axe = await new AxeBuilder({ page })
    .include('[data-testid="designer"]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );
});

test('a picture of a CV you like is enough to design from', async ({ page, request }) => {
  await config(request);
  await openDesign(page, { ...structuredClone(FIXTURES.teacher), id: 'designer-2' });
  const designer = page.getByTestId('designer');
  // A tiny valid PNG (the mock reads "a picture" as a two-column layout).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  await designer
    .getByLabel('Upload a picture of a CV you like')
    .setInputFiles({ name: 'liked-cv.png', mimeType: 'image/png', buffer: png });
  await expect(designer.getByText('liked-cv.png')).toBeVisible();
  await designer.getByRole('button', { name: 'Design it' }).click();
  await expect(designer.getByTestId('designer-candidate').first()).toContainText(
    'From your picture',
  );
  // Only pictures are accepted.
  const bad = await page.request.post('/api/designs/compose', {
    data: {
      input: {
        description: '',
        presetId: 'teacher',
        stats: { pages: 1, sections: [], hasPhoto: false },
      },
      image: { data: Buffer.from('%PDF-1.4 not an image').toString('base64') },
    },
  });
  expect(bad.status()).toBe(400);
});

test.describe('free accounts', () => {
  test.use({ as: 'free' });
  test('one compose to try; then the Premium offer; downloads of it need Premium', async ({
    page,
    request,
  }) => {
    await config(request);
    await openDesign(page, { ...structuredClone(FIXTURES.nurse), id: 'designer-free' });
    const designer = page.getByTestId('designer');
    await expect(designer).toContainText('1 free design to try');
    await designer
      .getByLabel('Describe the CV you imagine')
      .fill('three columns, purple, square bullets');
    await designer.getByRole('button', { name: 'Design it' }).click();
    await expect(designer.getByTestId('designer-candidate')).toHaveCount(3);
    await designer
      .getByTestId('designer-candidate')
      .first()
      .getByRole('button', { name: /Use the/ })
      .click();
    await expect(page.getByTestId('designer-note')).toContainText('Now using');
    await expect(page.getByTestId('studio-base')).toContainText('Your own design');
    await designer.getByRole('button', { name: 'Try again' }).click();
    await expect(designer.getByRole('link', { name: 'See Premium' })).toBeVisible();
    // The design made with the free try can be previewed but not downloaded.
    await page.getByRole('link', { name: 'Download' }).click();
    await expect(page).toHaveURL(/\/download$/);
    await expect(page.locator('[data-gate="premium-design"]')).toContainText(
      'Custom designs are part of Premium',
    );
  });
});

test.describe('visitors', () => {
  test.use({ as: 'visitor' });
  test('are asked to sign in', async ({ page, request }) => {
    await config(request);
    const res = await request.post('/api/designs/compose', {
      data: {
        input: {
          description: 'navy, two columns',
          presetId: 'general',
          stats: { pages: 1, sections: [], hasPhoto: false },
        },
      },
    });
    expect(res.status()).toBe(401);
    const refine = await request.post('/api/designs/refine', {
      data: { input: { instruction: 'square bullets', current: {} } },
    });
    expect(refine.status()).toBe(401);
    void page;
  });
});

test('the picker has 32 designs in 8 families; a spec design switches in one click', async ({
  page,
  request,
}) => {
  await config(request);
  await openDesign(page, { ...structuredClone(FIXTURES.driver), id: 'designer-pick' });
  const picker = page.getByRole('radiogroup', { name: 'Design' });
  await expect(picker.getByRole('radio')).toHaveCount(32);
  await page
    .getByRole('group', { name: 'Design families' })
    .getByRole('button', { name: 'Compact grid' })
    .click();
  await expect(picker.getByRole('radio')).toHaveCount(4);
  await picker.getByRole('radio', { name: /Three-column grid · Mosaic/ }).click();
  await expect(picker.getByRole('radio', { name: /Mosaic/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect.poll(() => previewTemplate(page)).toBe('custom');
  await expect(page.getByTestId('studio-base')).toContainText('Based on Mosaic');
  // Back to a crafted design re-attaches it.
  await page
    .getByRole('group', { name: 'Design families' })
    .getByRole('button', { name: 'All' })
    .click();
  await picker.getByRole('radio', { name: /Clarity/ }).click();
  await expect.poll(() => previewTemplate(page)).toBe('clarity');
});
