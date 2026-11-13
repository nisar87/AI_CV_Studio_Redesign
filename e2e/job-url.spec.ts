import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';

/** R9.5: add a job from its link — safe server fetch, page read as data, the person checks. */
const page = (baseURL: string, name: string) =>
  `${baseURL.replace('localhost', '127.0.0.1')}/api/test/job-page/${name}`;

test('a job board link with job data fills the form; the person saves it', async ({
  page: p,
  baseURL,
}) => {
  await p.goto('/jobs?new=1');
  const form = p.getByRole('form', { name: 'Add a job' });
  await form.getByLabel('Link to the advert').fill(page(baseURL!, 'jsonld'));
  await form.getByRole('button', { name: 'Fill in from the link' }).click();
  await expect(form.getByTestId('job-read')).toContainText('Check it before you save', {
    timeout: 15_000,
  });
  await expect(form.getByLabel('Job title')).toHaveValue('Multi-drop Delivery Driver');
  await expect(form.getByLabel('Company')).toHaveValue('Fresh Foods Ltd');
  await expect(form.getByLabel('Location')).toHaveValue('Leicester');
  await expect(form.getByLabel('The job advert')).toHaveValue(
    /^You will deliver chilled groceries[\s\S]*Apply with your CV by 30 November\.$/,
  );
  const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );
  await form.getByRole('button', { name: 'Save job' }).click();
  await expect(p.getByText('Job added')).toBeVisible();
  const jobs = (await (await p.request.get('/api/jobs')).json()) as {
    jobs: { title: string; url: string; advert: string }[];
  };
  expect(jobs.jobs[0]).toMatchObject({
    title: 'Multi-drop Delivery Driver',
    url: page(baseURL!, 'jsonld'),
  });
  // Reading a link is not an AI action (spec §14).
  const ent = (await (await p.request.get('/api/me/entitlements')).json()) as {
    usage: Record<string, number>;
  };
  expect(ent.usage['ai.action']).toBe(0);
});

test('a careers page without job data is read by the AI, checked against the page', async ({
  page: p,
  baseURL,
}) => {
  // Opened with the link in the address (as the browser extension will): fills in by itself.
  await p.goto(`/jobs?new=1&url=${encodeURIComponent(page(baseURL!, 'plain'))}`);
  const form = p.getByRole('form', { name: 'Add a job' });
  await expect(form.getByTestId('job-read')).toBeVisible({ timeout: 15_000 });
  await expect(form.getByLabel('Job title')).toHaveValue('Van Driver');
  await expect(form.getByLabel('Company')).toHaveValue('Swift Logistics');
  const advert = await form.getByLabel('The job advert').inputValue();
  expect(advert).toMatch(/reliable van driver/);
  // The hidden instruction on the page never reaches the form, and page clutter is cut away.
  expect(advert).not.toMatch(/Chief Executive|Similar jobs|Sign in/);
});

test('unsafe or unusable links are refused with a plain message', async ({ request, baseURL }) => {
  const tryUrl = async (url: string) => {
    const r = await request.post('/api/jobs/fetch', { data: { url } });
    return { status: r.status(), body: (await r.json()) as { error?: { message: string } } };
  };
  // Private and metadata addresses, other schemes, credentials and odd ports.
  for (const url of [
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://[::1]/',
    'http://2130706433/',
    'file:///etc/passwd',
    'https://user:pw@example.com/job',
    'https://example.com:8443/job',
    'http://metadata.google.internal/',
  ]) {
    const r = await tryUrl(url);
    expect(r.status, url).toBeGreaterThanOrEqual(400);
    expect(r.body.error?.message, url).toBeTruthy();
  }
  // A public page that redirects to a private address is stopped at the redirect.
  expect((await tryUrl(page(baseURL!, 'redirect-private'))).body.error?.message).toBe(
    'That link can’t be read.',
  );
  // Redirects to allowed pages are followed.
  expect((await tryUrl(page(baseURL!, 'redirect-ok'))).status).toBe(200);
  // Too large, too slow, not a web page, blocked by the site, not one job.
  expect((await tryUrl(page(baseURL!, 'big'))).body.error?.message).toMatch(/too large/);
  expect((await tryUrl(page(baseURL!, 'slow'))).body.error?.message).toMatch(/too long/);
  expect((await tryUrl(page(baseURL!, 'pdf'))).body.error?.message).toMatch(/isn’t a web page/);
  expect((await tryUrl(page(baseURL!, 'blocked'))).body.error?.message).toMatch(
    /doesn’t let us read/,
  );
  expect((await tryUrl(page(baseURL!, 'list'))).body.error?.message).toMatch(
    /doesn’t look like one job advert/,
  );
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('can read links within the job limit, and not past it', async ({ request, baseURL }) => {
    expect(
      (await request.post('/api/jobs/fetch', { data: { url: page(baseURL!, 'jsonld') } })).status(),
    ).toBe(200);
    for (const t of ['One', 'Two', 'Three'])
      await request.post('/api/jobs', { data: { title: `Job ${t}` } });
    const r = await request.post('/api/jobs/fetch', { data: { url: page(baseURL!, 'jsonld') } });
    expect(r.status()).toBe(402);
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in', async ({ request, baseURL }) => {
    const r = await request.post('/api/jobs/fetch', { data: { url: page(baseURL!, 'jsonld') } });
    expect(r.status()).toBe(401);
  });
});
