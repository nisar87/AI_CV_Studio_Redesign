/**
 * Renders catalogue designs to PNG pages for human review.
 * Usage: npx tsx scripts/design-review.tsx [out-dir] [id,id,…] [fixture,fixture,…]
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { FIXTURES, withPhoto, PHOTO_FOR } from '../src/modules/resume/fixtures';
import { DESIGNS } from '../src/modules/design/designs';
import { ops } from '../src/modules/resume/ops';
import type { ResumeDocument } from '../src/modules/resume/schema';
import { buildDocumentHtml } from '../src/modules/templates/build-document';

const out = process.argv[2] ?? '/tmp/review';
const ids = process.argv[3] ? process.argv[3].split(',') : DESIGNS.map((d) => d.id);
const fixtures = (process.argv[4] ?? 'teacher,engineer').split(',') as (keyof typeof FIXTURES)[];
fs.mkdirSync(out, { recursive: true });
const read = (f: string) => fs.readFileSync(path.join('public/fonts/cv', f)).toString('base64');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
for (const id of ids) {
  const meta = DESIGNS.find((d) => d.id === id)!;
  for (const f of fixtures) {
    let base: ResumeDocument = FIXTURES[f];
    const photo = PHOTO_FOR[f];
    if (meta.photo && photo) base = withPhoto(base, photo);
    const doc = ops.useDesign(base, meta.id);
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 });
    await page.setContent(buildDocumentHtml(doc, { fonts: { kind: 'inline', read } }));
    await page.waitForFunction('window.__CV_READY__ !== undefined');
    const r = (await page.evaluate('window.__CV_READY__')) as { pages: number; overflow: number };
    const pages = await page.$$('.cv-page');
    for (let i = 0; i < pages.length; i++)
      await pages[i]!.screenshot({ path: path.join(out, `${id}-${f}-p${i + 1}.png`) as `${string}.png` });
    console.log(id, f, JSON.stringify(r));
    await page.close();
  }
}
await browser.close();
