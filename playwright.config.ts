import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3100);
const chromePath = process.env.CHROME_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // Preview documents load fonts and paginate before assertions can pass; allow for busy CI machines.
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...(chromePath ? { launchOptions: { executablePath: chromePath } } : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    env: {
      RATE_LIMIT_PDF_PER_MINUTE: '1000',
      // AI e2e runs use the deterministic mock provider; generous limits for parallel workers.
      AI_PROVIDER: 'mock',
      AI_REQUESTS_PER_10_MIN: '1000',
      AI_REQUESTS_PER_DAY: '100000',
      AI_DAILY_BUDGET: '1000000',
    },
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
