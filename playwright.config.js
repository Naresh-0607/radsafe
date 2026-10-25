import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
process.env.RADSAFE_UI_PASSWORD ||= randomBytes(20).toString('hex');
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel:
      process.env.RADSAFE_TEST_CHANNEL ||
      (process.platform === 'win32' &&
      existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
        ? 'msedge'
        : undefined),
    headless: true,
    actionTimeout: 15000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/tests/ui-server.js',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 120000,
  },
  reporter: 'list',
});
