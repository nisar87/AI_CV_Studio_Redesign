/**
 * Catalogue gates (complete-studio-spec §8.3) for every catalogue design, in production Chromium
 * print mode. Each design × standard fixture:
 *  - parity: zero overflow; PDF page count = layout page count; fonts embedded, no Type 3;
 *  - top-third: name, headline and the first job title within the top 40% of page one;
 *  - round trip: our own import reads the PDF back with ≥ 97% content coverage and the right
 *    employer for every job;
 *  - geometry-sorted extraction (`pdftotext -layout`): section order recoverable for
 *    single-column designs and for the ATS-safe version of every design.
 *
 * Usage: npx tsx scripts/catalogue-gates.tsx [id,id,…]    (exit code 1 on any failure)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import { migrateV1 } from '../src/modules/design/catalogue';
import { atsSafeSpec } from '../src/modules/design/normalise';
import { DESIGNS } from '../src/modules/design/designs';
import { renderPdfFromHtml } from '../src/modules/export/render';
import { COVERAGE_TARGET, coverage, documentText } from '../src/modules/import/coverage';
import { extractLines } from '../src/modules/import/extract';
import { parseCv } from '../src/modules/import/parse';
import { FIXTURES, PHOTO_FOR, withPhoto, type FixtureId } from '../src/modules/resume/fixtures';
import { ops } from '../src/modules/resume/ops';
import type { ResumeDocument } from '../src/modules/resume/schema';
import { buildDocumentHtml } from '../src/modules/templates/build-document';

/**
 * Top-third rule: 40% of page one. Recorded deviation (docs/STATUS.md, R7): four hand-crafted
 * designs whose large portrait or two-tone header is their signature reach 41–45% with the longer
 * sample CVs; they passed the outside reviews and keep their header.
 */
const TOP_THIRD_ALLOWANCE: Record<string, number> = { vivid: 46, halo: 46, folio: 46, sprout: 46 };
const STANDARD: FixtureId[] = ['driver', 'teacher', 'nurse', 'graduate', 'engineer', 'executive'];
const only = process.argv[2]?.split(',');
const read = (f: string) => fs.readFileSync(path.join('public/fonts/cv', f)).toString('base64');

function tool(name: string, pdf: Uint8Array, args: string[]): string {
  const file = path.join(
    os.tmpdir(),
    `gate-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`,
  );
  fs.writeFileSync(file, pdf);
  try {
    return execFileSync(name, [...args, file, ...(name === 'pdftotext' ? ['-'] : [])]).toString();
  } finally {
    fs.unlinkSync(file);
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

type Job = { role: string; organization: string };
const jobs = (d: ResumeDocument): Job[] =>
  d.sections
    .filter((s) => s.kind === 'experience' && !s.hidden)
    .flatMap((s) => s.items as unknown as Job[]);

/** Positions of name, headline and first job title on page one, as a share of page height. */
async function topThird(browser: Browser, html: string, doc: ResumeDocument) {
  const page = await browser.newPage();
  try {
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForFunction('window.__CV_READY__ !== undefined');
    // The first entry in reading order (a graduate's CV starts with education on purpose).
    const first = doc.sections.find(
      (s) =>
        !s.hidden && s.items.length && ['experience', 'education', 'projects'].includes(s.kind),
    )?.items[0] as { role?: string; qualification?: string; name?: string } | undefined;
    const want = {
      // First word only: some designs set the first and last name in separate runs.
      name: doc.basics.name.split(' ')[0] ?? '',
      headline: doc.basics.headline,
      entry: first?.role ?? first?.qualification ?? first?.name ?? '',
    };
    return (await page.evaluate((w: Record<string, string>) => {
      const p1 = document.querySelector('.cv-page')!;
      const box = p1.getBoundingClientRect();
      const out: Record<string, number> = {};
      for (const [k, text] of Object.entries(w)) {
        if (!text) continue;
        const walker = document.createTreeWalker(p1, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          const t = n.textContent ?? '';
          const at = t.toLowerCase().indexOf(text.slice(0, 18).toLowerCase());
          if (at < 0) continue;
          const r = document.createRange();
          r.setStart(n, at);
          r.setEnd(n, Math.min(t.length, at + 1));
          out[k] = (r.getBoundingClientRect().top - box.top) / box.height;
          break;
        }
        if (out[k] === undefined) out[k] = 9; // not on page one
      }
      return out;
    }, want)) as Record<string, number>;
  } finally {
    await page.close();
  }
}

/** Section titles appear in document order in a position-sorted text extraction. */
function sectionOrder(text: string, doc: ResumeDocument): string | null {
  const flat = text.replace(/\s+/g, ' ');
  let last = -1;
  for (const s of doc.sections) {
    if (s.hidden || !s.items.length) continue;
    const re = new RegExp(
      s.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
      'i',
    );
    const m = re.exec(flat.slice(last + 1));
    if (!m) return `"${s.title}" not found after position ${last}`;
    last = last + 1 + m.index;
  }
  return null;
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const fails: string[] = [];
let checks = 0;
const fail = (m: string) => {
  fails.push(m);
  console.log('FAIL', m);
};

for (const meta of DESIGNS) {
  if (only && !only.includes(meta.id)) continue;
  for (const fx of [...STANDARD, 'sparse', 'extreme'] as FixtureId[]) {
    const src = meta.photo && PHOTO_FOR[fx] ? withPhoto(FIXTURES[fx], PHOTO_FOR[fx]) : FIXTURES[fx];
    const doc = ops.useDesign(src, meta.id);
    const label = `${meta.id} × ${fx}`;
    const html = buildDocumentHtml(doc, { fonts: { kind: 'inline', read } });
    const r = await renderPdfFromHtml(browser, html);
    checks++;
    // Parity
    const info = tool('pdfinfo', r.pdf, []);
    const pdfPages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
    if (r.overflow !== 0) fail(`${label}: overflow ${r.overflow}`);
    if (pdfPages !== r.pages) fail(`${label}: layout ${r.pages} pages, PDF ${pdfPages}`);
    const fonts = tool('pdffonts', r.pdf, []);
    if (fonts.includes('Type 3')) fail(`${label}: Type 3 font`);
    if (/\bno\s+(yes|no)\s+(yes|no)\s+\d+/.test(fonts)) fail(`${label}: font not embedded`);
    if (!STANDARD.includes(fx)) continue;

    // Top-third rule
    const pos = await topThird(browser, html, doc);
    const max = TOP_THIRD_ALLOWANCE[meta.id] ?? 40;
    for (const [k, v] of Object.entries(pos))
      if (Math.round(v * 100) > max)
        fail(`${label}: ${k} at ${Math.round(v * 100)}% of page one (max ${max}%)`);

    // Round trip through our own import (rules parser, as in CI)
    const { lines } = await extractLines(r.pdf);
    const { doc: back } = parseCv(lines);
    const cov = coverage(documentText(src).split('\n'), back);
    if (cov.ratio < COVERAGE_TARGET)
      fail(
        `${label}: round-trip coverage ${(cov.ratio * 100).toFixed(1)}% (${cov.missing.slice(0, 2).join(' | ')})`,
      );
    const got = jobs(back);
    for (const j of jobs(src)) {
      const hit = got.find((g) => norm(g.organization).includes(norm(j.organization)));
      if (!hit) fail(`${label}: employer "${j.organization}" not read back`);
    }

    // Geometry-sorted extraction: single-column designs as they are, every design's ATS-safe version
    // Section labels in a margin read like a second column in position-sorted text.
    const spec = doc.design.v2 ?? migrateV1(doc.design);
    if (spec.layout.type === 'single' || spec.layout.type === 'timeline') {
      const why = sectionOrder(tool('pdftotext', r.pdf, ['-layout']), src);
      if (why) fail(`${label}: layout extraction order — ${why}`);
    }
    if (fx === 'engineer') {
      const v2 = doc.design.v2 ?? migrateV1(doc.design);
      const ats = ops.setSpec(doc, { ...atsSafeSpec(v2), atsSafe: true });
      const a = await renderPdfFromHtml(
        browser,
        buildDocumentHtml(ats, { fonts: { kind: 'inline', read } }),
      );
      const why = sectionOrder(tool('pdftotext', a.pdf, ['-layout']), src);
      if (why) fail(`${meta.id} ATS-safe: layout extraction order — ${why}`);
    }
  }
  console.log('done', meta.id);
}
await browser.close();
console.log(`\n${checks} renders, ${fails.length} failures`);
if (fails.length) process.exit(1);
