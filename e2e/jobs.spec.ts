import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R2: job tracker. */
test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in, and the API refuses', async ({ page }) => {
    await page.goto('/jobs');
    await expect(
      page.getByRole('heading', { name: 'Sign in to track your applications' }),
    ).toBeVisible();
    expect((await page.request.get('/api/jobs')).status()).toBe(401);
    expect((await page.request.post('/api/jobs', { data: { title: 'x' } })).status()).toBe(401);
  });
});

test.describe('free account', () => {
  test.use({ as: 'free' });

  test('add, move, edit, link a CV, and the 3-job limit', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/cv'); // lets the seeded CV sync into the account
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { name: 'No jobs yet' })).toBeVisible();
    await page.getByRole('button', { name: 'Add a job' }).click();
    await page.getByLabel('Job title').fill('Delivery Driver');
    await page.getByLabel('Company').fill('Swift Logistics');
    await page
      .getByLabel('The job advert')
      .fill('We need a reliable van driver with a clean licence.');
    await page.getByRole('button', { name: 'Save job' }).click();
    await expect(page.getByTestId('jobs-count')).toHaveText('1 of 3 jobs');
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      [],
    );

    // Move with the select: lands in Applied with today's date.
    await page.getByLabel('Stage for Delivery Driver').selectOption('applied');
    await expect(page.locator('[data-stage="applied"]')).toContainText('Delivery Driver');
    await expect(page.locator('[data-stage="applied"]')).toContainText('Applied');

    // Detail: notes and the CV used.
    await page.getByRole('link', { name: 'Delivery Driver' }).click();
    await expect(page.getByRole('heading', { name: 'Delivery Driver', level: 1 })).toBeVisible();
    await page.getByLabel('Notes').fill('Call Sara on Monday');
    await page.getByTestId('job-cvs').getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Notes')).toHaveValue('Call Sara on Monday');
    await expect(page.getByTestId('job-cvs').getByRole('checkbox').first()).toBeChecked();

    // Limit: two more fit, the fourth is refused (button and API).
    for (const title of ['Courier', 'Warehouse Operative'])
      expect((await page.request.post('/api/jobs', { data: { title } })).status()).toBe(200);
    await page.goto('/jobs');
    await expect(page.getByTestId('jobs-count')).toHaveText('3 of 3 jobs');
    await expect(page.getByRole('button', { name: 'Add a job' })).toBeDisabled();
    const fourth = await page.request.post('/api/jobs', { data: { title: 'Fourth' } });
    expect(fourth.status()).toBe(402);

    // Removing one frees a place.
    await page.getByRole('link', { name: 'Courier' }).click();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Remove this job' }).click();
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByTestId('jobs-count')).toHaveText('2 of 3 jobs');
  });

  test('bad input and other people’s jobs are refused', async ({ page, request }) => {
    expect((await page.request.post('/api/jobs', { data: { title: '' } })).status()).toBe(400);
    expect(
      (
        await page.request.post('/api/jobs', { data: { title: 'x', url: 'javascript:alert(1)' } })
      ).status(),
    ).toBe(400);
    const { job } = (await (
      await page.request.post('/api/jobs', { data: { title: 'Mine' } })
    ).json()) as {
      job: { id: string };
    };
    // `request` is a different account.
    expect((await request.get(`/api/jobs/${job.id}`)).status()).toBe(404);
    expect((await request.put(`/api/jobs/${job.id}`, { data: { title: 'stolen' } })).status()).toBe(
      404,
    );
  });
});

test('Premium has no job limit', async ({ page }) => {
  for (let i = 0; i < 5; i++)
    expect((await page.request.post('/api/jobs', { data: { title: `Job ${i}` } })).status()).toBe(
      200,
    );
  const r = (await (await page.request.get('/api/jobs')).json()) as {
    jobs: unknown[];
    max: number;
  };
  expect(r.max).toBe(-1);
  expect(r.jobs).toHaveLength(5);
});
