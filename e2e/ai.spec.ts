import AxeBuilder from '@axe-core/playwright';
import type { Page, Route } from '@playwright/test';
import { expect, test } from './support/test';
import { driver } from '../src/modules/resume/fixtures';

/**
 * Phase 4 AI flows, run against the deterministic mock provider (AI_PROVIDER=mock in the
 * Playwright web server). Failure paths are simulated by intercepting /api/ai/*.
 */

const previewFrame = (page: Page) =>
  page.locator('iframe[title^="Preview of your CV"]:not([aria-hidden])').contentFrame();

async function seed(page: Page, doc = driver) {
  await page.addInitScript((d) => {
    if (!localStorage.getItem(`cvstudio:v1:doc:${d.id}`))
      localStorage.setItem(`cvstudio:v1:doc:${d.id}`, JSON.stringify(d));
  }, doc);
  await page.goto(`/cv/${doc.id}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
}

async function storedDoc(page: Page, id: string) {
  return page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? 'null'),
    `cvstudio:v1:doc:${id}`,
  );
}

async function newestDoc(page: Page) {
  return page.evaluate(() => {
    const docs = Object.keys(localStorage)
      .filter((k) => k.startsWith('cvstudio:v1:doc:'))
      .map((k) => JSON.parse(localStorage.getItem(k)!));
    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  });
}

const summaryBox = (page: Page) => page.locator('[data-ai="summary"]');

test.describe('AI help', () => {
  test('status endpoint reports the demo provider', async ({ request }) => {
    const res = await request.get('/api/ai/status');
    expect(await res.json()).toEqual({ enabled: true, provider: 'mock' });
  });

  test('API rejects unknown tasks and invalid input with the error envelope', async ({
    request,
  }) => {
    const unknown = await request.post('/api/ai/write.poem', { data: { input: {} } });
    expect(unknown.status()).toBe(400);
    expect((await unknown.json()).error.code).toBe('INVALID_INPUT');
    const bad = await request.post('/api/ai/write.improveBullets', {
      data: { input: { presetId: 'driver', bullets: [], instruction: 'clearer' } },
    });
    expect(bad.status()).toBe(400);
    const ok = await request.post('/api/ai/suggest.skills', {
      data: { input: { presetId: 'driver', existing: [] } },
    });
    const body = await ok.json();
    expect(body).toMatchObject({ task: 'suggest.skills', version: 'skills@1', provider: 'mock' });
    expect(body.result.skills.length).toBeGreaterThan(0);
  });

  test('Start: "a simple CV for a delivery driver" sets up a driver CV', async ({ page }) => {
    await page.goto('/start');
    await page.getByLabel('Describe the CV you need').fill('A simple CV for a delivery driver');
    await page.getByRole('button', { name: 'Create my CV' }).click();
    await expect(page).toHaveURL(/\/cv\/[\w-]+\/guided$/);
    const doc = await newestDoc(page);
    expect(doc.presetId).toBe('driver');
    expect(doc.basics.headline).toBe('Delivery Driver');
    expect(doc.design.templateId).toBe('clarity');
    expect(doc.sections.map((s: { kind: string }) => s.kind)[0]).toBe('licences');
  });

  test('Start: the teacher example picks a blue, elegant design', async ({ page }) => {
    await page.goto('/start');
    await page
      .getByLabel('Describe the CV you need')
      .fill('I am a school teacher, I want a blue, modern, clean and elegant CV');
    await page.getByRole('button', { name: 'Create my CV' }).click();
    await expect(page).toHaveURL(/\/guided$/);
    const doc = await newestDoc(page);
    expect(doc.presetId).toBe('teacher');
    expect(doc.design).toMatchObject({ accent: '#1f4e8c', fontPair: 'executive' });
  });

  test('profile: write, use, see markers in preview and checklist, undo', async ({
    page,
    isMobile,
  }) => {
    await seed(page);
    await summaryBox(page).getByRole('button', { name: 'Help me write' }).click();
    await page.getByRole('menuitem', { name: 'Write a new one for me' }).click();
    const card = page.locator('[data-ai-card="done"]');
    await expect(card).toBeVisible();
    await expect(card.getByText('Demo AI')).toBeVisible();
    await expect(card.locator('mark')).toHaveCount(1);
    // Nothing changes until "Use this".
    expect((await storedDoc(page, driver.id)).basics.summary).toBe(driver.basics.summary);
    await card.getByRole('button', { name: 'Use this' }).click();
    const summary = page.getByLabel('A short introduction');
    await expect(summary).toHaveValue(
      /^Multi-drop Delivery Driver with experience at Swift Logistics/,
    );
    await expect(page.locator('[data-needs-input]').first()).toBeVisible();
    if (!isMobile) await expect(previewFrame(page).locator('.cv-page mark.cv-ask')).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(summary).toHaveValue(driver.basics.summary);
    await page.keyboard.press('Control+Shift+z');
    await expect(summary).toHaveValue(/\{\{\?/);
    await page.waitForTimeout(600);
    await page.goto(`/cv/${driver.id}/download`);
    await expect(
      page.getByText('Some suggested sentences still need a detail from you'),
    ).toBeVisible();
  });

  test('bullets: make shorter, try again, dismiss leaves text unchanged', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Covered on desktop');
    await seed(page);
    await page
      .getByRole('button', { name: /Multi-drop Van Driver/ })
      .first()
      .click();
    const box = page.locator('[data-ai="bullets"]').first();
    await box.getByRole('button', { name: 'Help me write' }).click();
    await page.getByRole('menuitem', { name: 'Make shorter' }).click();
    const card = box.locator('[data-ai-card="done"]');
    await expect(card.locator('li')).toHaveCount(3);
    await card.getByRole('button', { name: 'Try again' }).click();
    await expect(box.locator('[data-ai-card="done"] li')).toHaveCount(3);
    await box.getByRole('button', { name: 'Dismiss' }).click();
    await expect(box.locator('[data-ai-card]')).toHaveCount(0);
    expect((await storedDoc(page, driver.id)).sections[0].items[0].bullets).toEqual(
      (driver.sections[0]!.items[0] as { bullets: string[] }).bullets,
    );

    await box.getByRole('button', { name: 'Help me write' }).click();
    await page.getByRole('menuitem', { name: 'Sound more professional' }).click();
    await box.locator('[data-ai-card="done"]').getByRole('button', { name: 'Use this' }).click();
    await expect(box.locator('[data-ai-card]')).toHaveCount(0);
  });

  test('bullets: write from notes for an empty job', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Covered on desktop');
    await seed(page);
    await page.getByRole('button', { name: 'Add another job' }).click();
    const box = page.locator('[data-ai="bullets"]').last();
    await box.getByRole('button', { name: 'Help me write' }).click();
    await page.getByRole('menuitem', { name: 'Write from my notes' }).click();
    await box
      .getByLabel('Tell us what you did, in your own words')
      .fill('drove the van; loaded parcels every morning; checked tyres');
    await box.getByRole('button', { name: 'Write points' }).click();
    await box.getByRole('button', { name: 'Add these points' }).click();
    await expect(page.getByLabel('What did you do?').last()).toHaveValue(
      'Drove the van\nLoaded parcels every morning\nChecked tyres',
    );
  });

  test('skills: suggestions are only added when picked', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Covered on desktop');
    await seed(page);
    const skillsSection = page
      .locator('section[data-section]')
      .filter({ hasText: 'Skills' })
      .first();
    await skillsSection.locator('button[aria-controls^="item-body-"]').first().click();
    const box = page.locator('[data-ai="skills"]');
    await box.getByRole('button', { name: 'Suggest skills for me' }).click();
    const card = box.locator('[data-ai-card="done"]');
    const chips = card.getByRole('list', { name: 'Suggested skills' }).getByRole('button');
    await expect(chips.first()).toBeVisible();
    const first = (await chips.nth(0).innerText()).trim();
    const second = (await chips.nth(1).innerText()).trim();
    await chips.nth(0).click();
    await chips.nth(1).click();
    await card.getByRole('button', { name: 'Add 2 skills' }).click();
    const kws = (await storedDoc(page, driver.id)).sections.find(
      (s: { kind: string }) => s.kind === 'skills',
    ).items[0].keywords as string[];
    await expect
      .poll(async () => {
        const d = await storedDoc(page, driver.id);
        return d.sections.find((s: { kind: string }) => s.kind === 'skills').items[0].keywords;
      })
      .toEqual(expect.arrayContaining([first, second]));
    expect(kws.length).toBeGreaterThanOrEqual(6);
  });

  test('design: "Describe a style" offers choices and applies one', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Covered on desktop');
    await seed(page);
    await page.getByRole('tab', { name: 'Design' }).click();
    await page.getByLabel('Describe the look you want').fill('warm and personal, green');
    await page.getByRole('button', { name: 'Show me' }).click();
    const list = page.getByRole('list', { name: 'Suggested designs' });
    await expect(list.getByRole('button')).toHaveCount(3);
    await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
      .then((r) => {
        expect(
          r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
        ).toEqual([]);
      });
    await list.getByRole('button').first().click();
    await expect(previewFrame(page).locator('html[data-template="halo"]')).toHaveCount(1);
    const d = await storedDoc(page, driver.id);
    expect(d.design).toMatchObject({ templateId: 'halo', accent: '#2d6a3e', fontPair: 'humanist' });
    await page.keyboard.press('Control+z');
    await expect(
      previewFrame(page).locator(`html[data-template="${driver.design.templateId}"]`),
    ).toHaveCount(1);
  });

  const failures: [string, (r: Route) => Promise<void>, RegExp][] = [
    [
      'service unavailable',
      (r) =>
        r.fulfill({
          status: 503,
          json: {
            error: {
              code: 'AI_UNAVAILABLE',
              message: 'AI help is not available right now. You can keep writing yourself.',
            },
          },
        }),
      /not available right now/,
    ],
    [
      'timeout',
      (r) =>
        r.fulfill({
          status: 503,
          json: {
            error: {
              code: 'AI_UNAVAILABLE',
              message:
                'AI help is taking too long right now. Please try again, or keep writing yourself.',
            },
          },
        }),
      /taking too long/,
    ],
    [
      'invalid output',
      (r) =>
        r.fulfill({
          status: 502,
          json: {
            error: {
              code: 'AI_INVALID_OUTPUT',
              message: 'AI help gave an answer we could not use. Please try again.',
            },
          },
        }),
      /could not use/,
    ],
    [
      'rate limit',
      (r) =>
        r.fulfill({
          status: 429,
          headers: { 'Retry-After': '60' },
          json: {
            error: {
              code: 'RATE_LIMITED',
              message:
                'You have used AI help a lot in the last few minutes. Please wait a little and try again.',
            },
          },
        }),
      /wait a little/,
    ],
    ['network failure', (r) => r.abort('connectionfailed'), /couldn’t reach AI help/],
  ];

  for (const [name, handler, message] of failures) {
    test(`failure path: ${name} shows a friendly message and keeps the field editable`, async ({
      page,
    }) => {
      await page.route('**/api/ai/write.summary', handler);
      await seed(page);
      await summaryBox(page).getByRole('button', { name: 'Help me write' }).click();
      await page.getByRole('menuitem', { name: 'Improve what I wrote' }).click();
      const card = page.locator('[data-ai-card="error"]');
      await expect(card).toContainText(message);
      await expect(card.getByRole('button', { name: 'Try again' })).toBeVisible();
      const summary = page.getByLabel('A short introduction');
      await expect(summary).toHaveValue(driver.basics.summary);
      await summary.fill('Typed by hand.');
      await expect(summary).toHaveValue('Typed by hand.');
      await card.getByRole('button', { name: 'Dismiss' }).click();
      await expect(page.locator('[data-ai-card]')).toHaveCount(0);
    });
  }

  test('AI help can be turned off and back on', async ({ page }) => {
    await seed(page);
    await summaryBox(page).getByRole('button', { name: 'Help me write' }).click();
    await page.getByRole('menuitem', { name: 'Turn off AI help' }).click();
    await expect(page.getByRole('button', { name: 'Help me write' })).toHaveCount(0);
    await page.goto('/start');
    await expect(page.getByLabel('Describe the CV you need')).toHaveCount(0);
    await page.goto('/privacy');
    await page.getByLabel('Offer AI writing help on this device').check();
    await page.goto('/start');
    await expect(page.getByLabel('Describe the CV you need')).toBeVisible();
  });
});
