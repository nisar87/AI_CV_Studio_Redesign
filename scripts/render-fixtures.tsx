/**
 * Visual + PDF QA harness: renders every template × fixture to PDF and PNG.
 * Usage: npx tsx scripts/render-fixtures.tsx [outDir] [template,...] [fixture,...]
 * Prints pages / overflow per combination and verifies PDF page count matches the paginator.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { FIXTURES, PHOTO_FOR, withPhoto, type FixtureId } from '../src/modules/resume/fixtures';
import { getTemplate } from '../src/modules/templates/registry';
import { TEMPLATE_IDS, type TemplateId, type PageSize } from '../src/modules/resume/schema';
import { buildDocumentHtml } from '../src/modules/templates/build-document';
import { renderPdfFromHtml } from '../src/modules/export/render';

const outDir = process.argv[2] ?? 'artifacts/visual/templates';
const templates = (process.argv[3]?.split(',') ?? TEMPLATE_IDS) as TemplateId[];
const fixtures = (process.argv[4]?.split(',') ?? Object.keys(FIXTURES)) as FixtureId[];
const pageSizes = (process.env.PAGE_SIZES?.split(',') ?? ['A4']) as PageSize[];
const read = (f: string) => fs.readFileSync(path.join('public/fonts/cv', f)).toString('base64');

fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
let failures = 0;
for (const t of templates)
  for (const f of fixtures)
    for (const size of pageSizes) {
      let doc = structuredClone(FIXTURES[f]);
      if (process.env.PHOTO === '1') doc = withPhoto(doc, PHOTO_FOR[f]);
      doc.design.templateId = t;
      const rec = getTemplate(t).support.defaults.fontPair;
      if (rec && process.env.OWN_FONT !== '1') doc.design.fontPair = rec;
      doc.design.pageSize = size;
      const html = buildDocumentHtml(doc, { fonts: { kind: 'inline', read } });
      const name = `${t}-${f}${process.env.PHOTO === '1' ? '-photo' : ''}${size === 'A4' ? '' : '-letter'}`;
      const { pdf, pages, overflow } = await renderPdfFromHtml(browser, html);
      const pdfPath = path.join(outDir, `${name}.pdf`);
      fs.writeFileSync(pdfPath, pdf);
      const info = execFileSync('pdfinfo', [pdfPath]).toString();
      const pdfPages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
      const ok = pdfPages === pages && overflow === 0;
      if (!ok) failures++;
      // PNG of each page for visual review
      execFileSync('pdftoppm', [
        '-png',
        '-r',
        process.env.DPI ?? '60',
        pdfPath,
        path.join(outDir, name),
      ]);
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(28)} pages=${pages} pdfPages=${pdfPages} overflow=${overflow}`,
      );
    }
await browser.close();
if (failures) {
  console.error(`${failures} combination(s) failed`);
  process.exit(1);
}
