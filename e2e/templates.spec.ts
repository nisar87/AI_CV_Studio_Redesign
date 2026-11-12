import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from './support/test';
import { FIXTURES, PHOTO_FOR, withPhoto, type FixtureId } from '../src/modules/resume/fixtures';
import { TEMPLATE_IDS, type PageSize } from '../src/modules/resume/schema';
import { buildDocumentHtml } from '../src/modules/templates/build-document';

const hasPoppler = (() => {
  try {
    execFileSync('pdfinfo', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function pdfTool(tool: string, pdf: Buffer, args: string[] = []): string {
  const file = path.join(
    os.tmpdir(),
    `cv-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`,
  );
  fs.writeFileSync(file, pdf);
  try {
    return execFileSync(tool, [...args, file, ...(tool === 'pdftotext' ? ['-'] : [])]).toString();
  } finally {
    fs.unlinkSync(file);
  }
}

test.describe('template engine parity (desktop only)', () => {
  test.skip(({ isMobile }) => isMobile, 'Rendering checks run once');

  const combos: [string, FixtureId, PageSize, boolean][] = [];
  for (const t of TEMPLATE_IDS)
    for (const f of Object.keys(FIXTURES) as FixtureId[]) combos.push([t, f, 'A4', false]);
  for (const t of TEMPLATE_IDS)
    combos.push([t, 'teacher', 'Letter', false], [t, 'engineer', 'A4', true]);

  for (const [templateId, fixture, pageSize, photo] of combos) {
    const label = `${templateId} × ${fixture}${photo ? ' + photo' : ''} (${pageSize})`;
    test(`${label}: preview pages = PDF pages, text extractable`, async ({
      page,
      request,
      baseURL,
    }) => {
      const source = FIXTURES[fixture];
      const doc = structuredClone(photo ? withPhoto(source, PHOTO_FOR[fixture]) : source);
      doc.design = { ...doc.design, templateId: templateId as never, pageSize };

      // Preview: exactly what the browser preview loads (fonts by URL from the app).
      await page.goto('/help');
      const html = buildDocumentHtml(doc, { fonts: { kind: 'url', baseUrl: baseURL! } });
      await page.setContent(html);
      await page.waitForFunction(
        () => (window as unknown as { __CV_READY__?: unknown }).__CV_READY__ !== undefined,
      );
      const preview = await page.evaluate(
        () =>
          (window as unknown as { __CV_READY__: { pages: number; overflow: number } }).__CV_READY__,
      );
      expect(preview.overflow).toBe(0);

      // PDF from the API.
      const res = await request.post('/api/pdf', { data: { document: doc } });
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('application/pdf');
      const pdf = Buffer.from(await res.body());
      expect(Number(res.headers()['x-page-count'])).toBe(preview.pages);

      if (hasPoppler) {
        const info = pdfTool('pdfinfo', pdf);
        expect(Number(/Pages:\s+(\d+)/.exec(info)?.[1])).toBe(preview.pages);
        const size = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info);
        expect(Math.round(Number(size?.[1]))).toBe(pageSize === 'A4' ? 595 : 612);
        const fonts = pdfTool('pdffonts', pdf);
        expect(fonts).not.toMatch(/\bno\s+(yes|no)\s+(yes|no)\s+\d+/); // every font embedded ("emb" = yes)
        expect(fonts, 'fonts embed as TrueType, not Type 3').not.toContain('Type 3');
        // Accessible PDF basics: tagged, a language, the person's name as title, real headings.
        expect(info).toMatch(/Tagged:\s+yes/);
        if (doc.basics.name) expect(info).toContain(`Title:           ${doc.basics.name}`);
        expect(pdf.includes('/Lang (')).toBe(true);
        const struct = pdfTool('pdfinfo', pdf, ['-struct']);
        if (doc.basics.name) expect(struct, 'name is a heading').toMatch(/\bH1\b/);
        if (doc.sections.some((s) => !s.hidden && s.items.length))
          expect(struct, 'section titles are headings').toMatch(/\bH2\b/);
        const text = pdfTool('pdftotext', pdf, ['-layout']).replace(/\s+/g, ' ');
        if (doc.basics.name) expect(text).toContain(doc.basics.name.split(' ')[0]!);
        const firstRole = doc.sections.find((s) => s.kind === 'experience')?.items[0] as
          { role?: string } | undefined;
        if (firstRole?.role) expect(text).toContain(firstRole.role.split(' ')[0]!);
      }
    });
  }
});

test('Designs page renders all three templates with real content', async ({ page }) => {
  await page.goto('/templates');
  const frames = page.locator('iframe[title*="design with an example"][data-active]');
  // Previews are built lazily: off-screen cards show their static thumbnail first.
  const cards = page.locator('main ul > li');
  await expect(cards).toHaveCount(TEMPLATE_IDS.length);
  expect(await frames.count()).toBeLessThan(TEMPLATE_IDS.length);
  for (let i = 0; i < TEMPLATE_IDS.length; i++) {
    await cards.nth(i).scrollIntoViewIfNeeded();
    await expect(
      cards.nth(i).locator('iframe[data-active]').contentFrame().locator('html[data-cv-ready]'),
    ).toHaveCount(1);
  }
  await expect(frames).toHaveCount(TEMPLATE_IDS.length);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('radio', { name: 'Driver' }).click();
  await expect(frames.first()).toHaveAttribute('title', /example driver CV/);
  await expect(frames.first().contentFrame().locator('.cv-page h1')).toContainText('Imran');
});

test('PDF API validates input and reports errors in the documented envelope', async ({
  request,
}) => {
  const res = await request.post('/api/pdf', { data: { document: { hello: 'world' } } });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe('INVALID_INPUT');
  expect(res.headers()['x-request-id']).toBeTruthy();
});

test('health endpoint reports Chromium', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect((await res.json()).checks.chromium).toBe('ok');
});

test.describe('PDF text order and links (desktop only)', () => {
  test.skip(({ isMobile }) => isMobile || !hasPoppler, 'Needs poppler; runs once');
  for (const templateId of TEMPLATE_IDS) {
    test(`${templateId}: bullets extract directly under their job, contacts are links`, async ({
      request,
    }) => {
      const doc = structuredClone(FIXTURES.driver);
      doc.design = { ...doc.design, templateId: templateId as never };
      const res = await request.post('/api/pdf', { data: { document: doc } });
      const pdf = Buffer.from(await res.body());
      const raw = pdfTool('pdftotext', pdf, ['-raw']).replace(/\s+/g, ' ');
      const firstBullet = raw.indexOf('Deliver around 120 parcels');
      const secondJob = raw.indexOf('Courier Driver');
      const education = raw.indexOf('GCSEs including English');
      expect(firstBullet, 'first bullet present').toBeGreaterThan(-1);
      expect(firstBullet, `bullet comes before the next job:\n${raw.slice(0, 1500)}`).toBeLessThan(
        secondJob,
      );
      expect(secondJob, 'work history comes before education').toBeLessThan(education);
      const body = pdf.toString('latin1');
      expect(body).toMatch(/\/URI\s*\(mailto:imran\.qureshi@example\.com\)/);
      expect(body).toMatch(/\/URI\s*\(tel:07700900123\)/);
    });
  }
});

test.describe('pagination polish regressions (desktop only)', () => {
  test.skip(({ isMobile }) => isMobile, 'Runs once');
  async function render(
    page: import('@playwright/test').Page,
    baseURL: string,
    doc: ReturnType<typeof structuredClone<typeof FIXTURES.driver>>,
  ) {
    await page.goto('/help');
    await page.setContent(buildDocumentHtml(doc, { fonts: { kind: 'url', baseUrl: baseURL } }));
    await page.waitForFunction(
      () => (window as unknown as { __CV_READY__?: unknown }).__CV_READY__ !== undefined,
    );
    return page.evaluate(
      () =>
        (window as unknown as { __CV_READY__: { pages: number; nearlyFits: boolean } })
          .__CV_READY__,
    );
  }

  test('a small overflow is absorbed by tighter spacing instead of a near-empty page', async ({
    page,
    baseURL,
  }) => {
    for (const [templateId, fixture, photo] of [
      ['chronicle', 'graduate', true],
      ['heritage', 'executive', false],
    ] as const) {
      const base = photo ? withPhoto(FIXTURES[fixture], PHOTO_FOR[fixture]) : FIXTURES[fixture];
      const doc = structuredClone(base);
      doc.design = { ...doc.design, templateId };
      expect((await render(page, baseURL!, doc)).pages, `${templateId} × ${fixture}`).toBe(1);
    }
  });

  test('large skill groups split so page 1 side columns are used', async ({ page, baseURL }) => {
    for (const templateId of ['atelier', 'vivid', 'sprout'] as const) {
      const doc = structuredClone(FIXTURES.extreme);
      doc.design = { ...doc.design, templateId };
      await render(page, baseURL!, doc);
      const firstPage = page.locator('.cv-page').first();
      await expect(
        firstPage.getByText('Skill 1 with words', { exact: true }),
        templateId,
      ).toHaveCount(1);
    }
  });

  test('project URLs are clickable in the PDF', async ({ request }) => {
    test.skip(!hasPoppler, 'Needs poppler');
    const doc = structuredClone(FIXTURES.engineer);
    doc.design = { ...doc.design, templateId: 'clarity' };
    const res = await request.post('/api/pdf', { data: { document: doc } });
    const body = Buffer.from(await res.body()).toString('latin1');
    expect(body).toMatch(/\/URI\s*\(https:\/\/github\.com\/dokafor\/tokenbucket\)/);
  });
});

test.describe('layout invariants across all designs (desktop only)', () => {
  test.skip(({ isMobile }) => isMobile, 'Runs once');
  async function load(
    page: import('@playwright/test').Page,
    baseURL: string,
    doc: typeof FIXTURES.driver,
  ) {
    await page.goto('/help');
    await page.setContent(buildDocumentHtml(doc, { fonts: { kind: 'url', baseUrl: baseURL } }));
    await page.waitForFunction(
      () => (window as unknown as { __CV_READY__?: unknown }).__CV_READY__ !== undefined,
    );
  }

  test('no page starts with stray bullets from an ordinary-length job (A4 and Letter)', async ({
    page,
    baseURL,
  }) => {
    for (const templateId of TEMPLATE_IDS)
      for (const fixture of ['teacher', 'engineer', 'nurse', 'executive'] as const)
        for (const pageSize of ['A4', 'Letter'] as const) {
          const doc = structuredClone(withPhoto(FIXTURES[fixture], PHOTO_FOR[fixture]));
          doc.design = { ...doc.design, templateId, pageSize };
          await load(page, baseURL!, doc);
          const stray = await page.evaluate(
            () =>
              Array.from(document.querySelectorAll('.cv-page--rest .cv-main')).filter((m) =>
                m.firstElementChild?.classList.contains('b-bullet'),
              ).length,
          );
          expect(stray, `${templateId} × ${fixture} (${pageSize})`).toBe(0);
        }
  });

  test('continuation headers keep name and role visibly apart', async ({ page, baseURL }) => {
    for (const templateId of TEMPLATE_IDS) {
      const doc = structuredClone(FIXTURES.extreme);
      doc.design = { ...doc.design, templateId };
      await load(page, baseURL!, doc);
      const gap = await page.evaluate(() => {
        const row = document.querySelector('.cv-page--rest .cv-top [data-slot="running"] > *');
        if (!row || row.children.length < 2) return null;
        const a = row.children[0]!.getBoundingClientRect();
        const b = row.children[1]!.getBoundingClientRect();
        // Either side by side with a real gap, or stacked on separate lines.
        return b.top >= a.bottom - 1 ? 999 : b.left - a.right;
      });
      if (gap !== null) expect(gap, templateId).toBeGreaterThanOrEqual(12);
    }
  });
});
