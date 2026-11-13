import AxeBuilder from '@axe-core/playwright';
import { request as pwRequest } from '@playwright/test';
import { apiSignUp } from './support/auth';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R9.4: skill gap and learning plan — for a tracked job or a typed role. */
const ADVERT = [
  'Multi-drop Delivery Driver, Leicester.',
  'You will plan delivery routes each morning to meet timed delivery slots.',
  'Essential: a forklift licence and two years of cold-chain experience are required.',
].join('\n');

const axeClean = async (page: import('@playwright/test').Page) => {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );
};

test('Premium: a plan for a tracked job, with evidence, steps and progress', async ({ page }) => {
  await seedDocument(page, driver);
  await page.goto('/coach');
  const job = (await (
    await page.request.post('/api/jobs', {
      data: { title: 'Delivery Driver', company: 'Fresh Foods Ltd', advert: ADVERT },
    })
  ).json()) as { job: { id: string } };
  await page.reload();
  await page.getByRole('link', { name: 'Plan my skills' }).click();
  await expect(page).toHaveURL(/\/skills$/);
  await expect(page.getByText('No plans yet')).toBeVisible();
  await expect(page.getByLabel('Job', { exact: true })).toHaveValue(job.job.id);
  await axeClean(page);

  await page.getByRole('button', { name: 'Make my plan' }).click();
  const plan = page.getByTestId('skill-plan');
  await expect(plan).toBeVisible({ timeout: 30_000 });
  await expect(plan.getByRole('heading', { level: 2 })).toHaveText(
    'Delivery Driver at Fresh Foods Ltd',
  );
  // Skills the CV shows come with the person's own line and a "Show me" link.
  await expect(plan.getByRole('heading', { name: /^You already show/ })).toBeVisible();
  await expect(plan.getByRole('link', { name: 'Show me' }).first()).toHaveAttribute(
    'href',
    /^\/cv\/[\w-]+\?focus=/,
  );
  await expect(plan.getByRole('heading', { name: /^To learn/ })).toBeVisible();
  await expect(plan.getByText('a forklift licence').first()).toBeVisible();
  const steps = plan.getByTestId('plan-step');
  await expect(steps).toHaveCount(2);
  await expect(plan.getByTestId('plan-progress')).toHaveText('0 of 2 done');
  await axeClean(page);

  // Mark the first step done: progress, and the next steps to show it.
  await plan.getByLabel('Progress on a forklift licence').selectOption('done');
  await expect(plan.getByTestId('plan-progress')).toHaveText('1 of 2 done');
  await expect(steps.first().getByRole('link', { name: 'Add it to my CV' })).toBeVisible();
  await expect(steps.first().getByRole('link', { name: 'Write a story about it' })).toHaveAttribute(
    'href',
    '/stories',
  );
  await page.reload();
  await expect(page.getByTestId('plan-progress')).toHaveText('1 of 2 done');

  // A second plan for a typed role; both are kept and can be switched; delete one.
  await page.getByLabel('A role I’d like').check();
  await page.getByLabel('The role').fill('Transport planner');
  await page.getByRole('button', { name: 'Make my plan' }).click();
  await expect(page.getByTestId('skill-plan').getByRole('heading', { level: 2 })).toHaveText(
    'Transport planner',
    { timeout: 30_000 },
  );
  const nav = page.getByRole('navigation', { name: 'Your plans' });
  await expect(nav.getByRole('button')).toHaveCount(2);
  await nav.getByRole('button', { name: /Delivery Driver/ }).click();
  await expect(page.getByTestId('plan-progress')).toHaveText('1 of 2 done');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Delete the plan for “Delivery Driver/ }).click();
  await expect(page.getByTestId('skill-plan').getByRole('heading', { level: 2 })).toHaveText(
    'Transport planner',
  );

  const ent = (await (await page.request.get('/api/me/entitlements')).json()) as {
    usage: Record<string, number>;
  };
  expect(ent.usage['ai.action']).toBe(2);

  // A link from a job opens the page with that job chosen.
  await page.goto(`/skills?job=${job.job.id}`);
  await expect(page.getByLabel('Job', { exact: true })).toHaveValue(job.job.id);
});

test('another account cannot read or change a plan', async ({ request, baseURL }) => {
  const r = await request.post('/api/skills', {
    data: { document: driver, role: 'Transport planner' },
  });
  expect(r.status()).toBe(200);
  const { plan } = (await r.json()) as { plan: { id: string } };
  const other = await pwRequest.newContext({ baseURL });
  await apiSignUp(other);
  expect((await other.get(`/api/skills/${plan.id}`)).status()).toBe(404);
  expect((await other.put(`/api/skills/${plan.id}`, { data: { steps: ['done'] } })).status()).toBe(
    404,
  );
  expect((await other.delete(`/api/skills/${plan.id}`)).status()).toBe(404);
  await other.dispose();
  // Crafted input is refused.
  expect(
    (await request.post('/api/skills', { data: { document: driver, role: 'x' } })).status(),
  ).toBe(400);
  expect(
    (await request.post('/api/skills', { data: { document: driver, jobId: 'nope' } })).status(),
  ).toBe(404);
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('a plan is Premium, with a clear message', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/skills');
    await page.getByLabel('A role I’d like').check();
    await page.getByLabel('The role').fill('Transport planner');
    await page.getByRole('button', { name: 'Make my plan' }).click();
    await expect(page.getByText(/Premium/).first()).toBeVisible({ timeout: 15_000 });
    const r = await page.request.post('/api/skills', {
      data: { document: driver, role: 'Transport planner' },
    });
    expect(r.status()).toBe(402);
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in', async ({ page, request }) => {
    expect((await request.get('/api/skills')).status()).toBe(401);
    await page.goto('/skills');
    await expect(page.getByText('Sign in to plan your next skills')).toBeVisible();
  });
});
