import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './support/test';

/** R1.5 API — /api/import (the screen is now the Instant Makeover, see makeover.spec.ts). */
const FIX = join(process.cwd(), 'src/modules/import/__fixtures__');
const docx = {
  name: 'cv.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  buffer: readFileSync(join(FIX, 'word-sales.docx')),
};

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('the import API needs an account, and /cv/import opens the makeover', async ({ page }) => {
    const r = await page.request.post('/api/import', { multipart: { file: docx } });
    expect(r.status()).toBe(401);
    await page.goto('/cv/import');
    await expect(page).toHaveURL(/\/makeover$/);
  });
});

test.describe('free account', () => {
  test.use({ as: 'free' });

  test('reads a two-column PDF and a scan; the monthly allowance is enforced', async ({
    request,
  }) => {
    const pdf = {
      name: 'cv.pdf',
      mimeType: 'application/pdf',
      buffer: readFileSync(join(FIX, 'two-column.pdf')),
    };
    const a = await request.post('/api/import', { multipart: { file: pdf } });
    expect(a.status()).toBe(200);
    const j = (await a.json()) as { report: { sections: { kind: string; items: number }[] } };
    expect(j.report.sections.find((s) => s.kind === 'experience')?.items).toBe(6);
    const scan = {
      name: 'scan.pdf',
      mimeType: 'application/pdf',
      buffer: readFileSync(join(FIX, 'scanned.pdf')),
    };
    const b = await request.post('/api/import', { multipart: { file: scan } });
    expect(b.status()).toBe(200);
    expect(((await b.json()) as { scanned: boolean }).scanned).toBe(true);
    const third = await request.post('/api/import', { multipart: { file: docx } });
    expect(third.status()).toBe(402);
  });

  test('a file it cannot read is explained and not counted', async ({ request }) => {
    const r = await request.post('/api/import', {
      multipart: {
        file: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('GIF89a x') },
      },
    });
    expect(r.status()).toBe(400);
    expect(((await r.json()) as { error: { message: string } }).error.message).toContain(
      'Please choose a PDF, a Word file',
    );
    const e = (await (await request.get('/api/me/entitlements')).json()) as {
      usage: Record<string, number>;
    };
    expect(e.usage['import.cv']).toBe(0);
  });
});
