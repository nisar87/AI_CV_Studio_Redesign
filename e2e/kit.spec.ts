import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R8.4: the application kit — tailored CV, cover letter and email in one go. */
const ADVERT = [
  'Multi-drop Delivery Driver, Leicester.',
  'You will plan delivery routes each morning to meet timed delivery slots.',
  'Essential: a forklift licence and two years of cold-chain experience are required.',
  'We offer a company van, overtime and a friendly team.',
].join('\n');

async function addJob(page: import('@playwright/test').Page) {
  const r = await page.request.post('/api/jobs', {
    data: { title: 'Delivery Driver', company: 'Fresh Foods Ltd', advert: ADVERT },
  });
  expect(r.status()).toBe(200);
  return ((await r.json()) as { job: { id: string } }).job.id;
}

test('Premium: create the kit, see the three pieces together, download CV and letter', async ({
  page,
}) => {
  await seedDocument(page, driver);
  await page.goto('/studio');
  const id = await addJob(page);
  // Home points to the kit.
  await page.reload();
  await expect(page.getByTestId('next-action')).toHaveAttribute('data-action', 'kit');
  await page.getByTestId('next-action').getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${id}#kit$`));

  const kit = page.getByTestId('kit');
  await kit.getByRole('button', { name: 'Create the kit' }).click();
  await expect(kit.getByText('Tailored CV', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(kit.getByRole('link', { name: /Open the tailored CV/ })).toBeVisible();
  await expect(
    kit.frameLocator('iframe[title="Cover letter in the kit"]').getByText('Imran Qureshi').first(),
  ).toBeVisible();
  await expect(kit).toContainText('Application: Delivery Driver');
  // The kit counts as three AI actions.
  const ent = (await (await page.request.get('/api/me/entitlements')).json()) as {
    usage: Record<string, number>;
  };
  expect(ent.usage['ai.action']).toBe(3);
  // The letter editor below shows the same letter.
  await expect(page.getByTestId('letter-editor')).toBeVisible();

  const downloads: string[] = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  await kit.getByRole('button', { name: 'Download CV and letter' }).click();
  await expect.poll(() => downloads.length, { timeout: 30_000 }).toBe(2);
  expect(downloads.sort()).toEqual(['Imran-Qureshi-CV.pdf', 'Imran-Qureshi-Cover-Letter.pdf']);

  // Home no longer asks for a kit for this job.
  await page.goto('/studio');
  await expect(page.getByTestId('next-action')).not.toHaveAttribute('data-action', 'kit');
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('the kit is Premium', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/documents');
    const id = await addJob(page);
    const r = await page.request.post(`/api/jobs/${id}/kit`, { data: { document: driver } });
    expect(r.status()).toBe(402);
  });
});
