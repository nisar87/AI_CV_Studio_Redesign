import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './support/test';
import { FIXTURES, PHOTO_FOR, withPhoto } from '../src/modules/resume/fixtures';
import type { ResumeDocument } from '../src/modules/resume/schema';
import { buildDocumentHtml } from '../src/modules/templates/build-document';
import { enumSweep, randomSpec, rng } from '../src/modules/design/samples';
import { parseSpec, type DesignSpecV2 } from '../src/modules/design/spec';

/**
 * R6 design engine, in the browser: every value of every spec field and random specs lay out
 * with zero overflow; composed designs print to PDF with the same page count and text order.
 */
test.skip(({ isMobile }) => isMobile, 'Rendering checks run once');

type Ready = { pages: number; overflow: number };
const withSpec = (doc: ResumeDocument, v2: DesignSpecV2): ResumeDocument => ({
  ...doc,
  design: { ...doc.design, v2 },
});

async function render(page: Page, doc: ResumeDocument, baseURL: string): Promise<Ready> {
  await page.setContent(buildDocumentHtml(doc, { fonts: { kind: 'url', baseUrl: baseURL } }));
  await page.waitForFunction(
    () => (window as unknown as { __CV_READY__?: unknown }).__CV_READY__ !== undefined,
  );
  return page.evaluate(() => (window as unknown as { __CV_READY__: Ready }).__CV_READY__);
}

const docs = [
  FIXTURES.engineer,
  withPhoto(FIXTURES.teacher, PHOTO_FOR.teacher),
  FIXTURES.extreme,
  FIXTURES.sparse,
];

test('every enum value lays out with zero overflow', async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  await page.goto('/help');
  const bad: string[] = [];
  for (const { label, spec } of enumSweep())
    for (const d of docs) {
      const r = await render(page, withSpec(d, spec), baseURL!);
      if (r.overflow !== 0) bad.push(`${label} × ${d.basics.name || 'sparse'}: ${r.overflow}`);
    }
  expect(bad).toEqual([]);
});

test('random specs lay out with zero overflow', async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  await page.goto('/help');
  const r = rng(7);
  const fixtures = Object.values(FIXTURES);
  const bad: string[] = [];
  for (let i = 0; i < 300; i++) {
    const spec = randomSpec(r);
    const doc = fixtures[i % fixtures.length]!;
    const res = await render(page, withSpec(doc, spec), baseURL!);
    if (res.overflow !== 0) bad.push(`#${i} ${JSON.stringify(spec)}`);
  }
  expect(bad).toEqual([]);
});

const hasPoppler = (() => {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function pdfText(pdf: Buffer): string {
  const file = path.join(
    os.tmpdir(),
    `cv-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`,
  );
  fs.writeFileSync(file, pdf);
  try {
    return execFileSync('pdftotext', [file, '-']).toString();
  } finally {
    fs.unlinkSync(file);
  }
}

const PDF_SPECS: [string, object][] = [
  ['single plain', {}],
  [
    'sidebar-left deep',
    {
      layout: { type: 'sidebar-left', sideFill: 'deep', sideBleed: true },
      placement: { side: ['skills', 'languages', 'certifications'] },
    },
  ],
  [
    'sidebar-right band',
    {
      layout: { type: 'sidebar-right' },
      placement: { side: ['skills', 'languages'] },
      header: { style: 'band', band: 'angled' },
    },
  ],
  [
    'rails',
    {
      layout: { type: 'rails' },
      placement: { side: ['skills'], third: ['languages', 'certifications'] },
    },
  ],
  ['two-equal', { layout: { type: 'two-equal' }, placement: { side: ['skills', 'languages'] } }],
  ['label-column', { layout: { type: 'label-column' }, headings: { style: 'numbered' } }],
  ['timeline', { layout: { type: 'timeline' }, entries: { layout: 'timeline-dots' } }],
  [
    'split + dates-left',
    { header: { style: 'split' }, entries: { layout: 'dates-left', dateFormat: 'MM/YYYY' } },
  ],
  [
    'keep columns',
    {
      layout: { type: 'sidebar-left', continuation: 'keep-columns' },
      placement: { side: ['skills', 'languages'] },
    },
  ],
  [
    'contact in side',
    {
      layout: { type: 'sidebar-left' },
      placement: { side: ['skills'], contactIn: 'side' },
      header: { style: 'in-sidebar' },
    },
  ],
  [
    'decor + footer + qr',
    {
      decor: { kind: 'corner-shapes', intensity: 'medium' },
      furniture: { footer: 'contact' },
      extras: { qr: 'linkedin', referencesLine: true },
    },
  ],
  ['ats safe', { atsSafe: true, layout: { type: 'rails' } }],
];

for (const [label, patch] of PDF_SPECS)
  test(`PDF parity: ${label}`, async ({ page, request, baseURL }) => {
    await page.goto('/help');
    for (const base of [FIXTURES.extreme, withPhoto(FIXTURES.nurse, PHOTO_FOR.nurse)]) {
      const doc = withSpec(base, parseSpec(patch));
      const preview = await render(page, doc, baseURL!);
      expect(preview.overflow).toBe(0);
      const res = await request.post('/api/pdf', { data: { document: doc } });
      expect(res.status()).toBe(200);
      expect(Number(res.headers()['x-page-count'])).toBe(preview.pages);
      if (hasPoppler) {
        const text = pdfText(Buffer.from(await res.body())).replace(/\s+/g, ' ');
        const first = base.basics.name.split(' ')[0]!;
        const job = base.sections.find((s) => s.kind === 'experience');
        const role = job && 'items' in job ? (job.items[0] as { role: string }).role : '';
        // Name first, then the first job (main column before side columns in reading order).
        expect(text.indexOf(first)).toBeGreaterThan(-1);
        if (role) expect(text.indexOf(first)).toBeLessThan(text.indexOf(role));
      }
    }
  });
