import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R8.4: the editor's Check tab — health check plus the ATS check (PDF read back). */
const ADVERT = [
  'Multi-drop Delivery Driver, Leicester.',
  'You will plan delivery routes each morning to meet timed delivery slots.',
  'Essential: a Forklift licence and two years of Cold Chain experience are required.',
  'We offer a company van, overtime and a friendly team.',
].join('\n');

test.describe('free account', () => {
  test.use({ as: 'free' });

  test('runs the readability checks twice a month, with fixes that open the right place', async ({
    page,
    isMobile,
  }) => {
    // A weak opening ("Responsible for…") gives the health check something to suggest.
    const exp = driver.sections.find((x) => x.kind === 'experience')!;
    const items = exp.items as { bullets: string[] }[];
    await seedDocument(page, {
      ...driver,
      sections: driver.sections.map((x) =>
        x.id === exp.id
          ? ({
              ...x,
              items: items.map((it, i) =>
                i === 0
                  ? { ...it, bullets: ['Responsible for loading the van', ...it.bullets] }
                  : it,
              ),
            } as typeof x)
          : x,
      ),
    });
    await page.goto(`/cv/${driver.id}?tab=check`);
    await expect(page.getByTestId('health')).toBeVisible();
    const ats = page.getByTestId('ats');
    await expect(ats.getByTestId('ats-left')).toHaveText('2 of 2 left this month');
    await ats.getByRole('button', { name: 'Run the ATS check' }).click();
    const report = ats.getByTestId('ats-report');
    await expect(report).toBeVisible({ timeout: 30_000 });
    for (const id of ['readable', 'contact', 'jobs', 'order', 'headings'])
      await expect(report.locator(`[data-check="${id}"]`)).toHaveAttribute('data-status', 'pass');
    await expect(report).toContainText('Screening software reads this CV well.');
    await expect(ats.getByTestId('ats-left')).toHaveText('1 of 2 left this month');
    // No keywords without Premium.
    await expect(ats.getByTestId('ats-keywords')).toHaveCount(0);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      [],
    );

    // A health finding's "Show me" opens the field in the Content tab.
    if (!isMobile) {
      await page.getByTestId('health').getByRole('button', { name: 'Show me' }).first().click();
      await expect(page.getByRole('tab', { name: 'Content' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
  });

  test('the allowance is enforced on the server', async ({ request }) => {
    for (let i = 0; i < 2; i++)
      expect((await request.post('/api/quality/ats', { data: { document: driver } })).ok()).toBe(
        true,
      );
    const third = await request.post('/api/quality/ats', { data: { document: driver } });
    expect(third.status()).toBe(402);
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in', async ({ request }) => {
    expect((await request.post('/api/quality/ats', { data: { document: driver } })).status()).toBe(
      401,
    );
  });
});

test('Premium: keywords for a saved job, re-checked against the CV', async ({ page }) => {
  await seedDocument(page, driver);
  await page.goto('/documents');
  const r = await page.request.post('/api/jobs', {
    data: { title: 'Delivery Driver', company: 'Fresh Foods Ltd', advert: ADVERT },
  });
  const jobId = ((await r.json()) as { job: { id: string } }).job.id;
  await page.goto(`/cv/${driver.id}?tab=check`);
  const ats = page.getByTestId('ats');
  await ats.getByLabel('Check keywords for a job').selectOption(jobId);
  await expect(ats.getByTestId('ats-left')).toHaveCount(0);
  await ats.getByRole('button', { name: 'Run the ATS check' }).click();
  const kw = ats.getByTestId('ats-keywords');
  await expect(kw).toBeVisible({ timeout: 30_000 });
  await expect(kw).toContainText('Keywords for Delivery Driver');
  // "Forklift" is not in the driver's CV; "Leicester" is.
  await expect(kw.getByRole('list', { name: 'Keywords not in your CV' })).toContainText('Forklift');
  await expect(kw.getByRole('list', { name: 'Keywords in your CV' })).toContainText('Leicester');
});
