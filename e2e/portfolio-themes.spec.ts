import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';
import { THEMES, THEME_INFO, themeForDoc } from '../src/modules/portfolio/themes';

/** R9.8: portfolio themes, own sections, projects with pictures, contact form, QR code. */
type Outbox = { to: string; subject: string; text: string; replyTo?: string }[];

// A real 8×8 PNG (the browser resizes it to WebP before upload).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YaOBFTEMLQkAdntLARs7+acAAAAASUVORK5CYII=',
  'base64',
);

const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

async function synced(page: Page) {
  await seedDocument(page, driver);
  await page.goto('/cv');
  await expect
    .poll(async () => (await page.request.get(`/api/documents/${driver.id}`)).status(), {
      timeout: 15_000,
    })
    .toBe(200);
}

const stranger = async (browser: Browser) => {
  const ctx = await browser.newContext({
    extraHTTPHeaders: {
      'x-forwarded-for': `10.8.${Date.now() % 250}.${Math.floor(Math.random() * 250)}`,
    },
  });
  return { ctx, page: await ctx.newPage() };
};

test('premium: theme, own section, project with a picture, preview, contact form, QR', async ({
  page,
  browser,
  context,
}, info) => {
  page.on('dialog', (d) => void d.accept());
  await synced(page);
  await page.goto('/portfolio');
  const picker = page.getByTestId('theme-picker');
  const auto = THEME_INFO[themeForDoc(driver)].name;
  await expect(picker.getByText(`${auto}, from your CV’s design`)).toBeVisible();
  await expect(picker.getByRole('radio')).toHaveCount(7);
  await expect(picker.getByRole('radio', { name: /Match my CV/ })).toBeChecked();
  await picker.getByRole('radio', { name: /Sidebar/ }).check();

  // An own section with a link.
  const sections = page.getByTestId('sections-editor');
  await sections.getByRole('button', { name: 'Add a section' }).click();
  const sec = sections.getByTestId('custom-section');
  await sec.getByLabel('Title').fill('What I’m looking for');
  await sec
    .getByLabel('Text', { exact: true })
    .fill('A driving job with regular routes.\n\nHappy to start early.');
  await sec.getByLabel('Link (optional)').fill('example.com/about-me');

  // A project with a picture, resized in the browser and uploaded.
  const projects = page.getByTestId('projects-editor');
  await projects.getByRole('button', { name: 'Add a project' }).click();
  const proj = projects.getByTestId('project');
  await proj.getByLabel('Project name').fill('Route planner sheet');
  await proj.getByLabel('What it is and what you did').fill('A one-page plan for 120 drops a day.');
  await proj
    .locator('input[type=file]')
    .setInputFiles({ name: 'route.png', mimeType: 'image/png', buffer: PNG });
  await expect(proj.getByLabel('Describe picture 1')).toBeVisible();
  await proj.getByLabel('Describe picture 1').fill('The route planner on one page');
  await expect
    .poll(() =>
      proj
        .locator('img')
        .first()
        .evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth),
    )
    .toBeGreaterThan(0);

  await page.getByLabel('Add a contact form').check();
  expect(await serious(page)).toEqual([]);

  // Preview, before saving: the draft in the chosen theme.
  const [preview] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Preview', exact: true }).click(),
  ]);
  await expect(preview.getByRole('note')).toContainText('Preview in the Sidebar theme');
  await expect(preview.locator('[data-theme]')).toHaveAttribute('data-theme', 'sidebar');
  await expect(preview.getByRole('heading', { name: 'What I’m looking for' })).toBeVisible();
  await expect(preview.getByRole('img', { name: 'The route planner on one page' })).toBeVisible();
  await preview.getByLabel('Your name').fill('Test');
  await preview.getByLabel('Your email').fill('t@example.com');
  await preview.getByLabel('Message').fill('Hi');
  await preview.getByRole('button', { name: 'Send message' }).click();
  await expect(preview.getByText(/This is a preview/)).toBeVisible();
  await preview.close();
  // Another theme from its own Preview link.
  const [bold] = await Promise.all([
    context.waitForEvent('page'),
    picker.getByRole('button', { name: 'Preview the Bold theme with my CV' }).click(),
  ]);
  await expect(bold.locator('[data-theme]')).toHaveAttribute('data-theme', 'bold');
  await bold.close();

  // Publish.
  const slug = `themes-${info.project.name}-${Date.now().toString(36)}`;
  await page.getByLabel('Your address').fill(slug);
  await page.getByRole('button', { name: 'Create my page' }).click();
  await expect(page.getByTestId('portfolio-live')).toContainText(`/p/${slug}`);
  const qr = page.getByTestId('portfolio-qr');
  await expect(qr.getByRole('img', { name: /QR code that opens/ })).toBeVisible();
  await expect(qr.getByRole('link', { name: 'PNG' })).toHaveAttribute('href', /^data:image\/png/);
  await expect(qr.getByRole('link', { name: /SVG/ })).toHaveAttribute('href', /^data:image\/svg/);

  // A stranger sees the page in the Sidebar theme, with the section, project and picture.
  const v = await stranger(browser);
  await v.page.goto(`/p/${slug}`);
  await expect(v.page.locator('[data-theme]')).toHaveAttribute('data-theme', 'sidebar');
  await expect(v.page.getByRole('heading', { name: 'What I’m looking for' })).toBeVisible();
  await expect(v.page.getByRole('link', { name: 'example.com/about-me' })).toHaveAttribute(
    'href',
    'https://example.com/about-me',
  );
  const pic = v.page.getByRole('img', { name: 'The route planner on one page' });
  await expect(pic).toBeVisible();
  const src = (await pic.getAttribute('src'))!;
  const res = await v.page.request.get(src);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^image\/(webp|jpeg)$/);
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(await serious(v.page)).toEqual([]);

  // The contact form sends one email to the owner; a reply goes to the visitor.
  const form = v.page.getByTestId('contact-form');
  await form.getByLabel('Your name').fill('Sara Recruiter');
  await form.getByLabel('Your email').fill('sara@example.com');
  await form.getByLabel('Message').fill('We have a route driver job in Leicester. Interested?');
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(v.page.getByTestId('contact-sent')).toContainText(
    'Imran will reply to sara@example.com',
  );
  const me = (await (await page.request.get('/api/me')).json()) as { user: { email: string } };
  const mails = async () =>
    (
      (await (await page.request.get('/api/test/setup')).json()) as { outbox: Outbox }
    ).outbox.filter(
      (m) => m.to === me.user.email && m.subject.includes('through your portfolio page'),
    );
  expect(await mails()).toHaveLength(1);
  const mail = (await mails())[0]!;
  expect(mail.replyTo).toBe('sara@example.com');
  expect(mail.text).toContain('We have a route driver job in Leicester');
  // The owner's address is never on the page.
  expect(await v.page.content()).not.toContain(me.user.email);
  // A robot filling the hidden field: looks sent, nothing is sent.
  const bot = await v.page.request.post(`/api/p/${slug}/contact`, {
    data: { name: 'Bot', email: 'b@example.com', message: 'Buy', website: 'x' },
  });
  expect(bot.status()).toBe(201);
  expect(await mails()).toHaveLength(1);
  const bad = await v.page.request.post(`/api/p/${slug}/contact`, {
    data: { name: 'X', email: 'not-an-email', message: 'Hi' },
  });
  expect(bad.status()).toBe(400);

  // Pictures: only the page's own are served; the owner's route needs their session.
  const up = await page.request.post('/api/portfolio/images', {
    headers: { 'content-type': 'image/png' },
    data: PNG,
  });
  expect(up.status()).toBe(201);
  const unused = ((await up.json()) as { image: { id: string } }).image.id;
  expect((await v.page.request.get(`/p/${slug}/img/${unused}`)).status()).toBe(404);
  expect((await v.page.request.get(`/api/portfolio/images/${unused}`)).status()).toBe(401);
  // Not a picture, or too large: refused.
  const html = await page.request.post('/api/portfolio/images', {
    headers: { 'content-type': 'image/png' },
    data: Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64, ' ')),
  });
  expect(html.status()).toBe(422);
  const huge = await page.request.post('/api/portfolio/images', {
    headers: { 'content-type': 'image/png' },
    data: Buffer.concat([PNG, Buffer.alloc(700 * 1024)]),
  });
  expect(huge.status()).toBe(413);
  // Crafted settings: someone else's picture, a javascript: link.
  const saved = (await (await page.request.get('/api/portfolio')).json()) as {
    portfolio: Record<string, unknown> & { projects: { images: { id: string }[] }[] };
  };
  const base = { ...saved.portfolio };
  const put = (patch: Record<string, unknown>) =>
    page.request.put('/api/portfolio', { data: { ...base, ...patch } });
  expect(
    (
      await put({
        projects: [{ id: 'x', title: 'X', images: [{ id: 'notmine123', alt: '' }] }],
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await put({ sections: [{ id: 's', title: 'S', text: '', link: 'javascript:alert(1)' }] })
    ).status(),
  ).toBe(400);

  // Another theme; contact form off.
  await page.reload();
  await picker.getByRole('radio', { name: /Classic/ }).check();
  await page.getByLabel('Add a contact form').uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Your page is live').first()).toBeVisible();
  await v.page.reload();
  await expect(v.page.locator('[data-theme]')).toHaveAttribute('data-theme', 'classic');
  await expect(v.page.getByTestId('contact-form')).toHaveCount(0);
  expect(
    (
      await v.page.request.post(`/api/p/${slug}/contact`, {
        data: { name: 'Sara', email: 'sara@example.com', message: 'Hi again' },
      })
    ).status(),
  ).toBe(404);
  expect(await serious(v.page)).toEqual([]);

  // Deleting the page deletes its pictures.
  const used = saved.portfolio.projects[0]!.images[0]!.id;
  await page.getByRole('button', { name: 'Delete my page' }).click();
  await expect(page.getByText('Portfolio page deleted')).toBeVisible();
  expect((await page.request.get(`/api/portfolio/images/${used}`)).status()).toBe(404);
  expect((await v.page.goto(`/p/${slug}`))?.status()).toBe(404);
  await v.ctx.close();
});

test('each theme has a sample page that passes the accessibility check', async ({
  page,
  isMobile,
}) => {
  for (const t of THEMES) {
    expect((await page.goto(`/portfolio-themes/${t}`))?.status()).toBe(200);
    await expect(page.locator('[data-theme]')).toHaveAttribute('data-theme', t);
    await expect(page.getByRole('note')).toContainText(`${THEME_INFO[t].name} theme`);
    // The sample CV has its own Projects section, so the gallery has another name.
    await expect(page.getByRole('heading', { name: 'Project gallery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toHaveCount(1);
    expect(await serious(page), t).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      t,
    ).toBeLessThanOrEqual(0);
  }
  expect((await page.goto('/portfolio-themes/neon'))?.status()).toBe(404);
  if (isMobile) return;
  // Each design page shows its portfolio theme.
  await page.goto('/templates/clarity');
  await page.getByRole('tab', { name: 'Matching portfolio page' }).click();
  await expect(page.getByText(/uses the Clean theme with this design/)).toBeVisible();
  const view = page.getByTestId('portfolio-theme-view');
  await expect(view.locator('[data-theme=clean]')).toBeVisible();
  await expect(view.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('pictures and the page are Premium', async ({ page }) => {
    await synced(page);
    const up = await page.request.post('/api/portfolio/images', {
      headers: { 'content-type': 'image/png' },
      data: PNG,
    });
    expect(up.status()).toBe(402);
    const put = await page.request.put('/api/portfolio', {
      data: { slug: `free-${Date.now()}`, docId: driver.id, published: true, theme: 'bold' },
    });
    expect(put.status()).toBe(402);
    await page.goto('/portfolio');
    await expect(page.getByText('Your portfolio page is part of Premium')).toBeVisible();
  });
});

test('visitors cannot upload pictures', async ({ browser }) => {
  const ctx = await browser.newContext();
  const r = await ctx.request.post('/api/portfolio/images', {
    headers: { 'content-type': 'image/png' },
    data: PNG,
  });
  expect(r.status()).toBe(401);
  await ctx.close();
});
