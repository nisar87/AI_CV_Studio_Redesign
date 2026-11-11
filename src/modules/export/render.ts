import type { Browser } from 'puppeteer-core';

export type CvReady = { pages: number; overflow: number; nearlyFits: boolean; fitted?: number };

/** Print a self-contained CV document (fonts inlined) to PDF. No network access is allowed. */
export async function renderPdfFromHtml(
  browser: Browser,
  html: string,
  { timeoutMs = 20_000 }: { timeoutMs?: number } = {},
): Promise<{
  pdf: Uint8Array;
  pages: number;
  overflow: number;
  fitted: number;
  nearlyFits: boolean;
}> {
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(true);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') void req.continue();
      else void req.abort('blockedbyclient');
    });
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    await page.waitForFunction('window.__CV_READY__ !== undefined', { timeout: timeoutMs });
    const ready = (await page.evaluate('window.__CV_READY__')) as CvReady;
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
      outline: false,
      timeout: timeoutMs,
    });
    return {
      pdf,
      pages: ready.pages,
      overflow: ready.overflow,
      fitted: ready.fitted ?? 0,
      nearlyFits: ready.nearlyFits,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}
