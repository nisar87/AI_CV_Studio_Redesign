import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R9.2: career coach chat — answers from the CV and jobs; actions go through the usual routes. */
const ADVERT = [
  'Multi-drop Delivery Driver, Leicester.',
  'You will plan delivery routes each morning to meet timed delivery slots.',
  'Essential: a forklift licence and two years of cold-chain experience are required.',
].join('\n');

test('Premium: ask, get advice from the CV, and let the coach start a tailored CV', async ({
  page,
}) => {
  await seedDocument(page, driver);
  await page.goto('/coach');
  await page.request.post('/api/jobs', {
    data: { title: 'Delivery Driver', company: 'Fresh Foods Ltd', advert: ADVERT },
  });
  await page.reload();
  const chat = page.getByTestId('coach-chat');
  await chat.getByRole('button', { name: 'Which of my skills should I lead with?' }).click();
  const coach = chat.locator('[data-role="coach"]');
  await expect(coach.first()).toContainText('Safe driving', { timeout: 30_000 });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );

  // A studio action, offered as a button and run through the normal tailor route.
  await chat
    .getByLabel('Message to your coach')
    .fill('Can you tailor my CV for the Fresh Foods job?');
  await chat.getByRole('button', { name: 'Send' }).click();
  const offer = chat.getByRole('button', {
    name: 'Make a CV tailored to Delivery Driver at Fresh Foods Ltd',
  });
  await expect(offer).toBeVisible({ timeout: 30_000 });
  // The conversation is kept.
  await page.reload();
  await expect(page.getByTestId('coach-chat').locator('[data-role="user"]')).toHaveCount(2);
  await page
    .getByTestId('coach-chat')
    .getByRole('button', { name: /Make a CV tailored/ })
    .click();
  await expect(page).toHaveURL(/\/cv\/[\w-]+$/, { timeout: 30_000 });
  await expect(page.getByLabel('CV name')).toHaveValue(/Delivery Driver \(Fresh Foods Ltd\)/);
  // 2 coach turns + 1 tailor = 3 AI actions, counted by the same gate as everywhere else.
  const ent = (await (await page.request.get('/api/me/entitlements')).json()) as {
    usage: Record<string, number>;
  };
  expect(ent.usage['ai.action']).toBe(3);

  // Letters are offered for the right situation, and the chat can be cleared.
  await page.goto('/coach');
  await page
    .getByTestId('coach-chat')
    .getByLabel('Message to your coach')
    .fill('I want to resign. Can you help?');
  await page.getByTestId('coach-chat').getByRole('button', { name: 'Send' }).click();
  await page.getByRole('button', { name: 'Write a resignation letter' }).click();
  await expect(page).toHaveURL(/\/letters\/new\?type=resignation/);
  await page.goto('/coach');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('coach-chat').getByRole('button', { name: 'Clear' }).click();
  await expect(
    page.getByRole('button', { name: 'Which of my skills should I lead with?' }),
  ).toBeVisible();
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('the coach is Premium; actions keep their own checks', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/coach');
    await expect(page.getByText('The career coach is part of Premium')).toBeVisible();
    const r = await page.request.post('/api/coach', { data: { document: driver, message: 'Hi' } });
    expect(r.status()).toBe(402);
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in', async ({ request }) => {
    expect((await request.get('/api/coach')).status()).toBe(401);
  });
});
