/**
 * Generates design-picker thumbnails (public/templates/<id>.webp) from real renders.
 * Usage: npx tsx scripts/template-thumbnails.tsx   (re-run after changing a template)
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { FIXTURES, withPhoto } from '../src/modules/resume/fixtures';
import { DESIGNS } from '../src/modules/design/designs';
import { ops } from '../src/modules/resume/ops';
import { buildDocumentHtml } from '../src/modules/templates/build-document';

const OUT = 'public/templates';
fs.mkdirSync(OUT, { recursive: true });
const read = (f: string) => fs.readFileSync(path.join('public/fonts/cv', f)).toString('base64');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const only = process.argv[2]?.split(',');
for (const meta of DESIGNS) {
  const id = meta.id;
  if (only && !only.includes(id)) continue;
  const classic = meta.family === 'classic';
  const base = classic ? FIXTURES.executive : FIXTURES.teacher;
  const doc = ops.useDesign(meta.photo ? withPhoto(base, classic ? 'b' : 'a') : base, id);
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 0.5 });
  await page.setContent(buildDocumentHtml(doc, { fonts: { kind: 'inline', read } }));
  await page.waitForFunction('window.__CV_READY__ !== undefined');
  const el = await page.$('.cv-page');
  await el!.screenshot({
    path: path.join(OUT, `${id}.webp`) as `${string}.webp`,
    type: 'webp',
    quality: 86,
  });
  await page.close();
  console.log('thumbnail', id);
}
await browser.close();
