import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from './support/test';
import { DEFAULT_CONFIG, type BusinessConfig } from '../src/modules/billing/config';
import { driver } from '../src/modules/resume/fixtures';
import { setConfig } from './support/auth';

/**
 * R1.2 — the single server-side entitlement gate. Config changes here only touch visitor/free
 * rules and design tiers; Premium test users elsewhere keep unlimited use, so parallel specs are
 * unaffected. The config is restored afterwards.
 */
test.describe.configure({ mode: 'serial' });

const UNLIMITED = { 'pdf.download': -1, 'import.cv': -1, 'ai.action': -1, 'design.ai': -1 };
const base: BusinessConfig = {
  ...DEFAULT_CONFIG,
  plans: { ...DEFAULT_CONFIG.plans, premium: { label: 'Premium', limits: UNLIMITED, maxJobs: -1 } },
};
const strict: BusinessConfig = {
  ...base,
  plans: {
    ...base.plans,
    free: {
      label: 'Free',
      limits: { 'pdf.download': 2, 'import.cv': 2, 'ai.action': 0, 'design.ai': 1 },
      maxJobs: 3,
    },
  },
  designs: base.designs.map((d) => ({
    ...d,
    tier: d.id === 'vivid' ? 'premium' : 'free',
    enabled: d.id !== 'sprout',
  })),
  features: { ...base.features, sales: true },
};

const doc = (templateId: string) => ({
  ...driver,
  design: { ...driver.design, templateId },
});
const pdf = (request: APIRequestContext, templateId = 'clarity') =>
  request.post('/api/pdf', { data: { document: doc(templateId) } });

async function seed(page: Page, templateId = 'clarity') {
  const d = doc(templateId);
  await page.addInitScript((x) => {
    if (!localStorage.getItem(`cvstudio:v1:doc:${x.id}`))
      localStorage.setItem(`cvstudio:v1:doc:${x.id}`, JSON.stringify(x));
  }, d);
  return d;
}

async function withApi(
  playwright: { request: { newContext: (o: { baseURL?: string }) => Promise<APIRequestContext> } },
  baseURL: string | undefined,
  fn: (r: APIRequestContext) => Promise<void>,
) {
  const r = await playwright.request.newContext({ baseURL });
  await fn(r);
  await r.dispose();
}
test.beforeAll(async ({ playwright, baseURL }) =>
  withApi(playwright, baseURL, (r) => setConfig(r, strict)),
);
test.afterAll(async ({ playwright, baseURL }) =>
  withApi(playwright, baseURL, (r) => setConfig(r, base)),
);

test.describe('visitor', () => {
  test.use({ as: 'visitor' });

  test('cannot download or use AI; the download page asks to sign in', async ({
    page,
    request,
  }) => {
    const r = await pdf(request);
    expect(r.status()).toBe(401);
    expect((await r.json()).error.code).toBe('SIGN_IN_REQUIRED');
    const ai = await request.post('/api/ai/suggest.skills', {
      data: { input: { presetId: 'driver' } },
    });
    expect((await ai.json()).error.code).toBe('SIGN_IN_REQUIRED');

    const d = await seed(page);
    await page.goto(`/cv/${d.id}/download`);
    const signIn = page.getByRole('link', { name: 'Sign in to download' });
    await expect(signIn).toHaveAttribute(
      'href',
      `/signin?next=${encodeURIComponent(`/cv/${d.id}/download`)}`,
    );
    await expect(page.getByRole('button', { name: 'Print' })).toHaveCount(0);
  });
});

test.describe('free account', () => {
  test.use({ as: 'free' });

  test('monthly download limit is enforced on the server and shown in the page', async ({
    page,
  }) => {
    const d = await seed(page);
    await page.goto(`/cv/${d.id}/download`);
    await expect(page.getByTestId('downloads-left')).toHaveText(
      '2 of 2 downloads left this month.',
    );
    // A Word download and a PDF download share the same allowance.
    const word = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Word (.docx)' }).click();
    const w = await word;
    expect(w.suggestedFilename()).toMatch(/\.docx$/);
    const fs = await import('node:fs');
    expect(
      fs
        .readFileSync(await w.path())
        .subarray(0, 2)
        .toString(),
    ).toBe('PK');
    await expect(page.getByTestId('downloads-left')).toHaveText(
      '1 of 2 downloads left this month.',
    );
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    await dl;
    await expect(page.getByTestId('downloads-left')).toHaveText(
      '0 of 2 downloads left this month.',
    );
    await page.getByRole('button', { name: 'Download PDF' }).click();
    await expect(page.getByText('Monthly download limit reached')).toBeVisible();
    await expect(page.getByRole('link', { name: 'See Premium' })).toBeVisible();
    expect(
      (await page.context().request.post('/api/docx', { data: { document: d } })).status(),
    ).toBe(402);
    // A crafted request is refused too.
    const r = await pdf(page.context().request);
    expect(r.status()).toBe(402);
    expect((await r.json()).error).toMatchObject({
      code: 'LIMIT_REACHED',
      details: { limit: 2, used: 2 },
    });
    await page.goto('/account');
    await expect(page.getByTestId('plan')).toContainText('Your plan: Free');
    await expect(page.getByTestId('plan')).toContainText('2 of 2');
  });

  test('Premium designs can be tried but not downloaded; switching keeps the words', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Covered on desktop');
    const d = await seed(page, 'vivid');
    // Server refuses a crafted request for the Premium design, without using the allowance.
    const r = await pdf(page.context().request, 'vivid');
    expect((await r.json()).error.code).toBe('PREMIUM_REQUIRED');

    await page.goto(`/cv/${d.id}`);
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByRole('radio', { name: /Vivid · Premium/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Sprout/ })).toHaveCount(0); // disabled design hidden
    await expect(page.locator('[data-gate="premium-note"]')).toBeVisible();

    await page.goto(`/cv/${d.id}/download`);
    await expect(page.locator('[data-gate="premium-design"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
    await page.getByRole('button', { name: 'Use a free design instead' }).click();
    await expect(page.locator('[data-gate="premium-design"]')).toHaveCount(0);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    expect((await dl).suggestedFilename()).toBe('Imran-Qureshi-CV.pdf');
    const stored = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem(`cvstudio:v1:doc:${id}`)!),
      d.id,
    );
    expect(stored.design.templateId).not.toBe('vivid');
    expect(stored.basics.name).toBe(driver.basics.name);
  });

  test('AI is part of Premium', async ({ request }) => {
    const r = await request.post('/api/ai/suggest.skills', {
      data: { input: { presetId: 'driver' } },
    });
    expect(r.status()).toBe(402);
    expect((await r.json()).error.code).toBe('PREMIUM_REQUIRED');
    const ent = await (await request.get('/api/me/entitlements')).json();
    expect(ent).toMatchObject({ plan: 'free', limits: { 'ai.action': 0 } });
  });
});

test.describe('premium', () => {
  test('Premium designs and AI work, and usage is counted', async ({ request }) => {
    expect((await pdf(request, 'vivid')).status()).toBe(200);
    expect(
      (
        await request.post('/api/ai/suggest.skills', { data: { input: { presetId: 'driver' } } })
      ).status(),
    ).toBe(200);
    const ent = await (await request.get('/api/me/entitlements')).json();
    expect(ent).toMatchObject({ plan: 'premium', usage: { 'pdf.download': 1, 'ai.action': 1 } });
    expect(ent.passExpiresAt).toBeTruthy();
  });

  test('a failed AI request is not counted', async ({ request }) => {
    const bad = await request.post('/api/ai/write.improveBullets', {
      data: { input: { presetId: 'driver', bullets: [] } },
    });
    expect(bad.status()).toBe(400);
    const ent = await (await request.get('/api/me/entitlements')).json();
    expect(ent.usage['ai.action']).toBe(0);
  });
});
