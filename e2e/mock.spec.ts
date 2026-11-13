import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R9.1: mock interview — one question at a time, feedback after each answer. */
const ADVERT = [
  'Multi-drop Delivery Driver, Leicester.',
  'You will plan delivery routes each morning to meet timed delivery slots.',
  'Essential: a forklift licence and two years of cold-chain experience are required.',
].join('\n');

async function addJob(page: import('@playwright/test').Page) {
  const r = await page.request.post('/api/jobs', {
    data: { title: 'Delivery Driver', company: 'Fresh Foods Ltd', advert: ADVERT },
  });
  return ((await r.json()) as { job: { id: string } }).job.id;
}

test('Premium: a five-question mock interview with feedback and a summary', async ({ page }) => {
  await seedDocument(page, driver);
  await page.goto('/coach');
  const id = await addJob(page);
  await page.reload();
  await page.getByRole('link', { name: 'Mock interview' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${id}#mock$`));
  const mock = page.getByTestId('mock');
  await mock.getByRole('button', { name: 'Start the mock interview' }).click();
  await expect(mock.getByTestId('mock-question')).toBeVisible({ timeout: 30_000 });
  await expect(mock.getByTestId('mock-progress')).toHaveText('Question 1 of 5');

  // A short answer can't be sent.
  await mock.getByLabel('Your answer').fill('Yes.');
  await expect(mock.getByRole('button', { name: 'Send answer' })).toBeDisabled();

  const answers = [
    'I want this job because I enjoy driving and helping customers.',
    'When a colleague was off sick I had to cover two routes, so I re-planned both and as a result every parcel arrived on time.',
    'I am good at planning routes.',
    'At Swift Logistics I deliver around 120 parcels a day across three postcode areas.',
    'In my first month I would learn the routes and meet the team.',
  ];
  for (const [i, a] of answers.entries()) {
    await mock.getByLabel('Your answer').fill(a);
    await mock.getByRole('button', { name: 'Send answer' }).click();
    await expect(mock.getByTestId('mock-feedback')).toHaveCount(i + 1, { timeout: 30_000 });
  }
  await expect(mock.getByTestId('mock-progress')).toHaveText('Finished');
  await expect(mock.getByTestId('mock-summary')).toBeVisible();
  // Feedback quotes the person's own words, and STAR parts are shown.
  await expect(mock.getByTestId('mock-feedback').nth(1)).toContainText('Strong answer');
  await expect(mock.getByTestId('mock-feedback').nth(2)).toContainText('Work on this one');
  await expect(mock.getByTestId('mock-feedback').first()).toContainText('About “I want this job”');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );
  // Start + 5 answers = 6 AI actions.
  const ent = (await (await page.request.get('/api/me/entitlements')).json()) as {
    usage: Record<string, number>;
  };
  expect(ent.usage['ai.action']).toBe(6);
  // Kept after a reload, and can be practised again.
  await page.reload();
  await expect(page.getByTestId('mock-summary')).toBeVisible();
  await page.getByRole('button', { name: 'Practise again' }).click();
  await expect(page.getByTestId('mock-progress')).toHaveText('Question 1 of 5', {
    timeout: 30_000,
  });
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('mock interviews are Premium', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/documents');
    const id = await addJob(page);
    const r = await page.request.post(`/api/jobs/${id}/interview/turn`, {
      data: { document: driver },
    });
    expect(r.status()).toBe(402);
  });
});
