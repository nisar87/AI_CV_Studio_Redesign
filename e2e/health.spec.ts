import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R2: CV check on the download page; "Show me" opens the editor at the field. */
test('the CV check lists fixes and opens the editor at the right job', async ({ page }) => {
  const d = structuredClone(driver);
  const exp = d.sections.find((s) => s.kind === 'experience')!;
  const job = exp.items[0] as {
    id: string;
    start: string;
    end: string;
    current: boolean;
    bullets: string[];
  };
  job.start = '';
  job.end = '';
  job.current = false;
  job.bullets = ['Responsible for loading the van'];
  await seedDocument(page, d);
  await page.goto(`/cv/${d.id}/download`);
  const health = page.getByTestId('health');
  await expect(health).toContainText('1 thing to fix before you send it');
  const dates = health.locator('[data-finding="dates-missing"]');
  await expect(dates).toContainText('Add dates to every job');
  await expect(health.locator('[data-finding="weak-openings"]')).toContainText(
    'Responsible for loading the van',
  );
  await dates.getByRole('link', { name: 'Show me' }).click();
  await expect(page).toHaveURL(new RegExp(`/cv/${d.id}\\?focus=`));
  await expect(page.locator(`#item-${job.id}`)).toBeInViewport();
});
