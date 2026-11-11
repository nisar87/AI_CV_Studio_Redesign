import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
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
  await expect(frames).toHaveCount(TEMPLATE_IDS.length);
  for (let i = 0; i < TEMPLATE_IDS.length; i++) {
    await expect(frames.nth(i).contentFrame().locator('html[data-cv-ready]')).toHaveCount(1);
  }
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
      expect(firstBullet, 'bullet comes before the next job').toBeLessThan(secondJob);
      expect(secondJob, 'work history comes before education').toBeLessThan(education);
      const body = pdf.toString('latin1');
      expect(body).toMatch(/\/URI\s*\(mailto:imran\.qureshi@example\.com\)/);
      expect(body).toMatch(/\/URI\s*\(tel:07700900123\)/);
    });
  }
});
