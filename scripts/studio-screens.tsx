// Captures studio screens with a realistic CV for visual review.
// Usage: npx tsx scripts/studio-screens.tsx <outDir> <baseUrl>
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { FIXTURES } from '../src/modules/resume/fixtures';

const [outDir = 'artifacts/visual/phase-3', base = 'http://localhost:3100'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
});
const doc = { ...FIXTURES.teacher, id: 'demo-teacher', title: 'Teaching CV' };
const driver = {
  ...FIXTURES.driver,
  id: 'demo-driver',
  title: 'Driver CV',
  updatedAt: '2026-10-01T10:00:00.000Z',
};
for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['phone', 390, 844],
] as const) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(base + '/help');
  await page.evaluate(
    ([a, b]) => {
      localStorage.setItem('cvstudio:v1:doc:' + a!.id, JSON.stringify(a));
      localStorage.setItem('cvstudio:v1:doc:' + b!.id, JSON.stringify(b));
    },
    [doc, driver],
  );
  const shots: [string, string, (() => Promise<void>)?][] = [
    [
      'editor',
      `/cv/${doc.id}`,
      async () => {
        await page
          .locator('#item-' + doc.sections[0]!.items[0]!.id)
          .getByRole('button')
          .first()
          .click();
      },
    ],
    [
      'editor-design',
      `/cv/${doc.id}`,
      async () => {
        if (name === 'phone')
          await page.getByRole('button', { name: 'Design', exact: true }).click();
        else await page.getByRole('tab', { name: 'Design' }).click();
      },
    ],
    [
      'guided',
      `/cv/${doc.id}/guided`,
      async () => {
        await page.getByRole('button', { name: 'Continue' }).click();
      },
    ],
    ['download', `/cv/${doc.id}/download`],
    ['my-cvs', `/cv`],
    ['home-returning', `/`],
  ];
  if (name === 'phone')
    shots.push([
      'editor-preview',
      `/cv/${doc.id}`,
      async () => {
        await page.getByRole('button', { name: 'Preview', exact: true }).click();
      },
    ]);
  for (const [label, path, act] of shots) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    if (act) await act();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${outDir}/${label}-${name}.png`, fullPage: false });
  }
  await page.close();
}
await browser.close();
console.log('done');
