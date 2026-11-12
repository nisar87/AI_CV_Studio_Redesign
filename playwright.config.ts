import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3100);
// PW_BROWSER_PATH lets the test browser differ from the server's PDF Chrome (CHROME_EXECUTABLE_PATH),
// to check preview/PDF parity across Chromium builds as in production.
const chromePath = process.env.PW_BROWSER_PATH || process.env.CHROME_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
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
      testIgnore: /(admin|premium)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', testIgnore: /(admin|premium)\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    {
      // Admin tests change site-wide settings (maintenance, sign-ups), so they run alone, last.
      name: 'admin',
      testMatch: /(admin|premium)\.spec\.ts/,
      dependencies: ['desktop', 'mobile'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      // Firebase Auth emulator: real sign-up/sign-in/sessions without touching production.
      command: 'npx firebase emulators:start --only auth --project demo-aicv',
      port: 9099,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run start -- -p ${PORT}`,
      env: {
        RATE_LIMIT_PDF_PER_MINUTE: '1000',
        RATE_LIMIT_IMPORT_PER_MINUTE: '1000',
        // AI e2e runs use the deterministic mock provider; generous limits for parallel workers.
        AI_PROVIDER: 'mock',
        AI_REQUESTS_PER_10_MIN: '1000',
        AI_REQUESTS_PER_DAY: '100000',
        AI_DAILY_BUDGET: '1000000',
        // Accounts: Auth emulator + in-memory document store.
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIREBASE_PROJECT_ID: 'demo-aicv',
        DATA_STORE: 'memory',
        E2E_TEST_HOOKS: '1',
        RATE_LIMIT_SESSION_PER_MINUTE: '100000',
        MAX_DOCS_PER_USER: '100000',
      },
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
