import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { Browser } from 'puppeteer-core';
import type { ResumeDocument } from '@/modules/resume/schema';
import { buildDocumentHtml } from '@/modules/templates/build-document';
import { renderPdfFromHtml } from './render';

/**
 * Server-side PDF rendering with headless Chromium.
 * Uses CHROME_EXECUTABLE_PATH or a locally installed Chrome; on serverless (Vercel/Lambda)
 * falls back to @sparticuz/chromium.
 */

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts', 'cv');
const fontCache = new Map<string, string>();

export function readFontBase64(file: string): string {
  let v = fontCache.get(file);
  if (!v) {
    v = fs.readFileSync(path.join(FONT_DIR, path.basename(file))).toString('base64');
    fontCache.set(file, v);
  }
  return v;
}

const LOCAL_CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');
  const explicit = process.env.CHROME_EXECUTABLE_PATH;
  const local = explicit || LOCAL_CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (local) {
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
        '--disable-gpu',
      ],
    });
  }
  // @sparticuz/chromium unpacks its bundled system libraries (NSS, expat…) only when it detects
  // AWS Lambda/Vercel/Netlify. Cloud Run (Firebase App Hosting) lacks those libraries, so opt in
  // explicitly; must be set before the module is first imported. Verified on Ubuntu 24.04.
  process.env.AWS_LAMBDA_JS_RUNTIME ??= 'nodejs22.x';
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
    args: [...chromium.args, '--font-render-hinting=none'],
  });
}

export async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.connected) return b;
  }
  browserPromise = launch();
  return browserPromise;
}

export async function chromiumAvailable(): Promise<boolean> {
  try {
    await getBrowser();
    return true;
  } catch (err) {
    browserPromise = null;
    console.error(
      JSON.stringify({
        level: 'error',
        area: 'pdf',
        message: `Chromium launch failed: ${(err as Error).message}`.slice(0, 1000),
      }),
    );
    return false;
  }
}

export async function renderResumePdf(
  doc: ResumeDocument,
): Promise<{ pdf: Uint8Array; pages: number; overflow: number }> {
  const html = buildDocumentHtml(doc, { fonts: { kind: 'inline', read: readFontBase64 } });
  const browser = await getBrowser();
  return renderPdfFromHtml(browser, html);
}
