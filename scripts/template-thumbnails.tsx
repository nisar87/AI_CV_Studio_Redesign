/**
 * Generates design-picker thumbnails (public/templates/<id>.webp) from real renders.
 * Usage: npx tsx scripts/template-thumbnails.tsx   (re-run after changing a template)
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { FIXTURES, withPhoto } from '../src/modules/resume/fixtures';
import { TEMPLATE_IDS } from '../src/modules/resume/schema';
import { buildDocumentHtml } from '../src/modules/templates/build-document';
import { getTemplate } from '../src/modules/templates/registry';

const OUT = 'public/templates';
fs.mkdirSync(OUT, { recursive: true });
const read = (f: string) => fs.readFileSync(path.join('public/fonts/cv', f)).toString('base64');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
for (const id of TEMPLATE_IDS) {
  const t = getTemplate(id);
  const base = id === 'heritage' ? FIXTURES.executive : FIXTURES.teacher;
  const doc = structuredClone(
    t.photo === 'optional' ? withPhoto(base, id === 'heritage' ? 'b' : 'a') : base,
  );
  doc.design.templateId = id;
  if (t.support.defaults.fontPair) doc.design.fontPair = t.support.defaults.fontPair;
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
