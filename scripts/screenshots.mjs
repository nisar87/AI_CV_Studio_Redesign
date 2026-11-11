// Usage: node scripts/screenshots.mjs <outDir> <baseUrl> <path...>
// Captures full-page screenshots at phone, tablet and desktop widths for visual review.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const [outDir, baseUrl, ...paths] = process.argv.slice(2);
const widths = [
  ['phone', 390, 844],
  ['tablet', 834, 1112],
  ['desktop', 1440, 900],
];
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
});
for (const [name, width, height] of widths) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  for (const p of paths) {
    await page.goto(baseUrl + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const file = path.join(
      outDir,
      `${(p.replace(/[/?=&]+/g, '_') || '_').replace(/^_/, '') || 'home'}-${name}.png`,
    );
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await page.close();
}
await browser.close();
