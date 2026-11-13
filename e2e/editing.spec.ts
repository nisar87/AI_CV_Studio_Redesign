import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';
import { cvFromProfile, makeProfile } from '../src/modules/resume/profile';
import type { ExperienceItem } from '../src/modules/resume/schema';

/** R8.6: edit on the page, drag to reorder, AI on a selection, "update your profile too?". */
const preview = (page: import('@playwright/test').Page) =>
  page.locator('iframe[title^="Preview of your CV"]:not([aria-hidden])').contentFrame();
const exp = driver.sections.find((s) => s.kind === 'experience')!;
const job = exp.items[0] as ExperienceItem;

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'Form and preview side by side on desktop');
});

test('edit a job title right on the page; the form follows and undo works', async ({ page }) => {
  await seedDocument(page, driver);
  await page.goto(`/cv/${driver.id}`);
  const title = preview(page).getByText(job.role, { exact: true }).first();
  await title.click();
  await expect(title).toHaveAttribute('contenteditable', /true|plaintext-only/);
  await page.keyboard.press('End');
  await page.keyboard.type(' (Team Lead)');
  await page.keyboard.press('Enter');
  await expect(preview(page).getByText(`${job.role} (Team Lead)`).first()).toBeVisible();
  // The form has the same text.
  await page
    .getByRole('button', { name: `${job.role} (Team Lead) ${job.organization}`, exact: true })
    .click();
  await expect(page.getByLabel('Job title', { exact: true }).first()).toHaveValue(
    `${job.role} (Team Lead)`,
  );
  // Undo is one step.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(preview(page).getByText(job.role, { exact: true }).first()).toBeVisible();
  // Escape cancels an edit.
  const t2 = preview(page).getByText(job.role, { exact: true }).first();
  await t2.click();
  await page.keyboard.type('xxx');
  await page.keyboard.press('Escape');
  await expect(preview(page).getByText(`${job.role}xxx`)).toHaveCount(0);
});

test('drag a section to a new place', async ({ page }) => {
  // Tall window: the drag starts and ends without scrolling.
  await page.setViewportSize({ width: 1440, height: 2600 });
  await seedDocument(page, driver);
  await page.goto(`/cv/${driver.id}`);
  const order = () =>
    page
      .locator('section[data-section]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-section')));
  await expect(page.locator('section[data-section]').first()).toBeVisible();
  const before = await order();
  const last = before[before.length - 1]!;
  await page
    .locator(`[data-drag-section="${last}"]`)
    .dragTo(page.locator(`section[data-section="${before[0]}"] header`));
  await expect.poll(order).toEqual([last, ...before.slice(0, -1)]);
});

test('Premium: rewrite only the selected words', async ({ page }) => {
  await seedDocument(page, driver);
  await page.goto(`/cv/${driver.id}`);
  await page
    .getByRole('button', { name: new RegExp(job.role) })
    .first()
    .click();
  const box = page.getByLabel('What did you do?').first();
  const first = job.bullets[0]!;
  const words = first.split(' ').slice(0, 3).join(' ');
  await box.focus();
  await page.keyboard.press('Control+Home');
  for (let i = 0; i < words.length; i++) await page.keyboard.press('Shift+ArrowRight');
  const bar = page.getByRole('toolbar', { name: 'Rewrite the selected words' });
  await bar.getByRole('button', { name: 'Shorten' }).click();
  await page.getByRole('button', { name: 'Replace the selection' }).click();
  await expect(box).not.toHaveValue(new RegExp(`^${words}`));
  await expect(box).toHaveValue(new RegExp(first.slice(words.length).trim().split(' ')[0]!));
});

test('a fact changed in a CV can be copied to the career profile', async ({ page }) => {
  const profile = makeProfile(driver);
  const cv = cvFromProfile(profile);
  await seedDocument(page, profile);
  await seedDocument(page, cv);
  await page.goto(`/cv/${cv.id}`);
  await page.getByLabel('Phone').fill('07700 111222');
  const banner = page.getByText('Update your career profile too?');
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Update profile' }).click();
  await expect(page.getByText('Career profile updated')).toBeVisible();
  await expect(banner).toBeHidden();
  await page.goto(`/cv/${profile.id}`);
  await expect(page.getByLabel('Phone')).toHaveValue('07700 111222');
});
