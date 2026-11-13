import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';

const PAGES = [
  { path: '/', heading: /see it transformed/i },
  { path: '/start', heading: /What kind of work do you do/i },
  { path: '/documents', heading: /Documents/i },
  { path: '/studio', heading: /Your studio/i },
  { path: '/presence', heading: /Presence/i },
  { path: '/coach', heading: /Coach/i },
  { path: '/templates', heading: /Designs/i },
  { path: '/help', heading: /Help/i },
  { path: '/privacy', heading: /Privacy/i },
  { path: '/terms', heading: /Terms of use/i },
  { path: '/premium', heading: /Every design/i },
  { path: '/makeover', heading: /Upload your CV, see it transformed/i },
  { path: '/signin', heading: /Sign in/i },
];

for (const { path, heading } of PAGES) {
  test(`${path} renders, has no horizontal scroll and no serious a11y violations`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious,
      JSON.stringify(
        serious.map((v) => [v.id, v.nodes.map((n) => n.target)]),
        null,
        2,
      ),
    ).toEqual([]);

    const original = page.viewportSize();
    await page.setViewportSize({ width: 360, height: 780 });
    const overflow360 = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow360, 'no horizontal scroll at 360px').toBeLessThanOrEqual(0);
    if (original) await page.setViewportSize(original);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('/cv now goes to Documents', async ({ page }) => {
  await page.goto('/cv');
  await expect(page).toHaveURL(/\/documents$/);
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('visitor top bar: Templates, Features, Pricing, Sign in, Upload my CV', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop bar');
    await page.goto('/');
    const bar = page.getByRole('banner');
    for (const name of [
      'Templates',
      'Features',
      'Pricing',
      'Sign in',
      'Upload my CV',
      'Start from scratch',
    ])
      await expect(bar.getByRole('link', { name, exact: true })).toBeVisible();
    await expect(page.locator('[data-shell="studio"]')).toHaveCount(0);
  });
});

test('home → start → choose a profession navigates to the builder', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create my CV' }).first().click();
  await expect(page).toHaveURL(/\/start$/);
  await page.getByRole('button', { name: /Driving & delivery/ }).click();
  await expect(page).toHaveURL(/\/cv\/new\?work=driver/);
});

test.describe('visitor keyboard', () => {
  test.use({ as: 'visitor' });
  test('keyboard users can skip to content and see focus', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard flow checked on desktop');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).outlineStyle,
    );
    expect(outline).not.toBe('none');
  });
});

test.describe('visitor menu', () => {
  test.use({ as: 'visitor' });
  test('mobile menu opens and closes with Escape', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile only');
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-menu')).toBeHidden();
  });
});
