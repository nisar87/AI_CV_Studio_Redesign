import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { setConfig, setPremium } from './support/auth';
import { DEFAULT_CONFIG } from '../src/modules/billing/config';
import { FIXTURES } from '../src/modules/resume/fixtures';
import { parseSpec } from '../src/modules/design/spec';
import type { ResumeDocument } from '../src/modules/resume/schema';

/**
 * R6 Design Studio (runs in the admin project: it turns a site-wide switch on).
 * Levels 2–3 bound to Design Spec v2, attach/detach, ATS-safe, Fit to one page, saved designs,
 * and the Premium gate for custom designs.
 */
const STUDIO = { ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, designStudio: true } };

async function on(request: APIRequestContext, value = true) {
  await setConfig(request, value ? STUDIO : DEFAULT_CONFIG);
}

/** data-template of the visible preview document. */
async function previewTemplate(page: Page) {
  return page
    // The main preview (picker cards and candidates have previews of their own).
    .frameLocator('iframe[data-active][title^="Preview of your CV"]')
    .first()
    .locator('html[data-cv-ready]')
    .getAttribute('data-template', { timeout: 10_000 })
    .catch(() => null);
}

async function openDesign(page: Page, doc: ResumeDocument) {
  await seedDocument(page, doc);
  await page.goto(`/cv/${doc.id}`);
  await page.getByRole('tab', { name: 'Design' }).click();
}

test.afterAll(async ({ request }) => {
  await on(request, false);
});

test('the studio is behind the switch; adjusting detaches, undo re-attaches', async ({
  page,
  request,
}) => {
  await on(request, false);
  await openDesign(page, FIXTURES.engineer);
  await expect(page.getByRole('radiogroup', { name: 'Design' })).toBeVisible();
  await expect(page.getByTestId('design-studio')).toHaveCount(0);

  await on(request, true);
  await page.reload();
  await page.getByRole('tab', { name: 'Design' }).click();
  const studio = page.getByTestId('design-studio');
  await expect(studio).toBeVisible();
  await expect(page.getByTestId('studio-base')).toContainText('Based on');
  const base = await previewTemplate(page);
  expect(base).not.toBe('custom');

  await studio.getByRole('radio', { name: 'Side column left' }).click();
  await expect(page.getByTestId('studio-base')).toContainText('Your own design');
  await expect.poll(() => previewTemplate(page)).toBe('custom');

  await studio.getByText('Headings', { exact: true }).click();
  await studio
    .getByRole('radiogroup', { name: 'Style' })
    .last()
    .getByRole('radio', { name: 'Coloured box' })
    .click();

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('studio-base')).toContainText('Based on');
  await expect.poll(() => previewTemplate(page)).toBe(base);

  const axe = await new AxeBuilder({ page })
    .include('[data-testid="design-studio"]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );
});

test('ATS-safe, saved designs, and Fit to one page', async ({ page, request }) => {
  await on(request, true);
  const doc: ResumeDocument = {
    ...structuredClone(FIXTURES.nurse),
    id: 'studio-fit',
    design: {
      ...FIXTURES.nurse.design,
      v2: parseSpec({
        layout: { type: 'sidebar-right' },
        placement: { side: ['skills'] },
        type: { basePt: 11.5, lineHeight: 1.55 },
        page: { marginMm: 21 },
        spacing: { sectionGapPt: 26, itemGapPt: 16 },
      }),
    },
  };
  await openDesign(page, doc);
  const studio = page.getByTestId('design-studio');

  // ATS-safe: one plain column, other choices kept.
  await studio.getByLabel('ATS-safe version').check();
  await expect(page.getByTestId('studio-base')).toContainText('ATS-safe version');
  await studio.getByLabel('ATS-safe version').uncheck();
  await expect(page.getByTestId('studio-base')).toContainText('Your own design');

  // Fit to one page runs the repair steps and reports what it changed.
  await expect(page.getByText(/^2 pages$/)).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('fit-one-page').click();
  await expect(page.getByTestId('fit-report')).toContainText(/fits on one page|Still \d pages/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('fit-report')).toContainText('compact spacing');
  await expect(page.getByText(/^1 page$/)).toBeVisible();

  // Save as my design; it is listed after a reload and applies to another CV.
  await studio.getByLabel('Design name').fill('Compact sidebar');
  await studio.getByRole('button', { name: 'Save as my design' }).click();
  await expect(page.getByTestId('save-design-msg')).toContainText('Saved “Compact sidebar”');
  const other = { ...structuredClone(FIXTURES.teacher), id: 'studio-other' };
  await openDesign(page, other);
  await page
    .getByTestId('my-designs')
    .getByRole('button', { name: 'Use “Compact sidebar”' })
    .click();
  await expect(page.getByTestId('studio-base')).toContainText('Your own design');
  await expect.poll(() => previewTemplate(page)).toBe('custom');
  // Bad specs are cleaned on the server; names are required.
  const bad = await page.request.post('/api/designs', { data: { name: ' ', spec: {} } });
  expect(bad.status()).toBe(400);
  const weird = await page.request.post('/api/designs', {
    data: { name: 'x', spec: { layout: { type: '<script>', sideWidthPct: 99 } } },
  });
  expect(weird.status()).toBe(201);
  const w = (await weird.json()) as { design: { spec: { layout: { type: string } } } };
  expect(w.design.spec.layout.type).toBe('single');
});

test('custom designs download with Premium; the ATS-safe version is free', async ({ request }) => {
  await setPremium(request, false);
  const custom = {
    ...FIXTURES.driver,
    design: { ...FIXTURES.driver.design, v2: parseSpec({ layout: { type: 'sidebar-left' } }) },
  };
  const denied = await request.post('/api/pdf', { data: { document: custom } });
  expect(denied.status()).toBe(402);
  expect(((await denied.json()) as { error: { message: string } }).error.message).toContain(
    'Custom designs are part of Premium',
  );
  const ats = {
    ...custom,
    design: {
      ...custom.design,
      v2: parseSpec({ atsSafe: true, layout: { type: 'sidebar-left' } }),
    },
  };
  expect((await request.post('/api/pdf', { data: { document: ats } })).status()).toBe(200);
  await setPremium(request, true);
  expect((await request.post('/api/pdf', { data: { document: custom } })).status()).toBe(200);
});
