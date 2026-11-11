import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { FIXTURES, type FixtureId } from '../src/modules/resume/fixtures';
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

  const combos: [string, FixtureId, PageSize][] = [];
  for (const t of TEMPLATE_IDS)
    for (const f of Object.keys(FIXTURES) as FixtureId[]) combos.push([t, f, 'A4']);
  for (const t of TEMPLATE_IDS) combos.push([t, 'teacher', 'Letter']);

  for (const [templateId, fixture, pageSize] of combos) {
    test(`${templateId} × ${fixture} (${pageSize}): preview pages = PDF pages, text extractable`, async ({
      page,
      request,
      baseURL,
    }) => {
      const doc = structuredClone(FIXTURES[fixture]);
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
  const frames = page.locator('iframe[title*="design with an example"]:not([aria-hidden])');
  await expect(frames).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(frames.nth(i).contentFrame().locator('html[data-cv-ready]')).toHaveCount(1);
  }
  await page.getByRole('radio', { name: 'Driver' }).click();
  await expect(frames.first()).toHaveAttribute('title', /example driver CV/);
  await expect(frames.first().contentFrame().locator('.cv-page h1')).toHaveText('Imran Qureshi');
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
