import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R2: job match, tailored CV and cover letter (demo AI provider). */
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

test.describe('premium account', () => {
  test('match, cover letter with PDF, and a tailored CV', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/cv');
    const id = await addJob(page);
    await page.goto(`/jobs/${id}`);
    const tools = page.getByTestId('job-tools');
    await expect(tools.getByLabel('Use this CV')).toBeVisible();

    // Match: grouped requirements, evidence quoted from the CV, keyword chips.
    await tools.getByRole('button', { name: 'Check how my CV matches' }).click();
    const match = page.getByTestId('match');
    await expect(match).toContainText('requirements clearly shown');
    await expect(match).toContainText('Plan routes each morning to meet timed delivery slots');
    await expect(match).toContainText('Not in your CV');
    await expect(match.getByRole('link', { name: 'Show me' }).first()).toHaveAttribute(
      'href',
      new RegExp(`/cv/${driver.id}\\?focus=`),
    );
    await expect(match.getByRole('list', { name: 'Keywords' })).toBeVisible();
    // Saved on the job.
    await page.reload();
    await expect(page.getByTestId('match')).toContainText('requirements clearly shown');

    // Cover letter: draft, edit, save, preview, PDF.
    await tools.getByRole('radio', { name: 'Formal' }).click();
    await tools.getByRole('button', { name: 'Write a cover letter' }).click();
    const editor = page.getByTestId('letter-editor');
    await expect(editor.getByLabel('Sign-off')).toHaveValue('Yours sincerely,');
    await expect(editor.getByLabel('Paragraph 1')).toHaveValue(
      /Delivery Driver role at Fresh Foods/,
    );
    const mail = editor.getByTestId('application-email');
    await expect(mail.getByLabel('Subject')).toHaveValue(
      'Application: Delivery Driver — Imran Qureshi',
    );
    await expect(mail.getByLabel('Email')).toHaveValue(/attached my CV and cover letter/);
    await expect(mail.getByRole('link', { name: 'Open in my email app' })).toHaveAttribute(
      'href',
      /^mailto:\?subject=Application%3A%20Delivery%20Driver/,
    );
    await mail.getByLabel('Subject').fill('Application: Delivery Driver (ref FF-12)');
    await editor.getByLabel('Paragraph 3').fill('I can start in two weeks. Thank you.');
    await editor.getByRole('button', { name: 'Save letter' }).click();
    await expect(editor.getByRole('button', { name: 'Save letter' })).toBeDisabled();
    const frame = page.frameLocator('[data-testid="letter-preview"]');
    await expect(frame.getByText('I can start in two weeks. Thank you.')).toBeVisible();
    await expect(frame.getByText('Imran Qureshi').first()).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      [],
    );
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      editor.getByRole('button', { name: 'Download PDF' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('Imran-Qureshi-Cover-Letter.pdf');
    const path = await download.path();
    const fs = await import('node:fs');
    expect(fs.readFileSync(path).subarray(0, 5).toString()).toBe('%PDF-');
    await page.reload();
    await expect(page.getByTestId('letter-editor').getByLabel('Paragraph 3')).toHaveValue(
      'I can start in two weeks. Thank you.',
    );
    await expect(page.getByTestId('application-email').getByLabel('Subject')).toHaveValue(
      'Application: Delivery Driver (ref FF-12)',
    );

    // Tailored CV: a new CV that opens in the editor and is linked to the job.
    await page.getByTestId('job-tools').getByRole('button', { name: 'Make a tailored CV' }).click();
    await page.waitForURL(
      (u) => /^\/cv\/[\w-]+$/.test(u.pathname) && !u.pathname.endsWith(driver.id),
    );
    const newId = new URL(page.url()).pathname.split('/').pop()!;
    const job = (await (await page.request.get(`/api/jobs/${id}`)).json()) as {
      job: { documentIds: string[] };
    };
    expect(job.job.documentIds).toContain(newId);
    const saved = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(`cvstudio:v1:doc:${k}`) ?? 'null'),
      newId,
    );
    expect(saved.title).toBe('Imran Qureshi — Delivery Driver (Fresh Foods Ltd)');
    expect(saved.jobId).toBe(id);
    // Same facts, different order: the first job's bullets were reordered, none dropped.
    const items = (d: typeof driver) =>
      d.sections.find((s) => s.kind === 'experience')!.items as { bullets: string[] }[];
    expect([...items(saved)[0]!.bullets].sort()).toEqual([...items(driver)[0]!.bullets].sort());
    expect(items(saved)[0]!.bullets).not.toEqual(items(driver)[0]!.bullets);
  });

  test('needs an advert first', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/cv');
    const r = await page.request.post('/api/jobs', { data: { title: 'Courier' } });
    const { job } = (await r.json()) as { job: { id: string } };
    await page.goto(`/jobs/${job.id}`);
    await expect(page.getByText('Paste the job advert first')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check how my CV matches' })).toBeDisabled();
    expect(
      (
        await page.request.post(`/api/jobs/${job.id}/match`, { data: { document: driver } })
      ).status(),
    ).toBe(400);
  });
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('sees the Premium offer, and the API refuses', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/cv');
    const id = await addJob(page);
    await page.goto(`/jobs/${id}`);
    await expect(
      page.getByText('Job match, tailoring and cover letters are part of Premium'),
    ).toBeVisible();
    for (const p of ['match', 'tailor', 'letter'])
      expect(
        (await page.request.post(`/api/jobs/${id}/${p}`, { data: { document: driver } })).status(),
      ).toBe(402);
  });
});
