import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../../tests/browser',
  testMatch: ['dkim-prototype.spec.ts', 'core3.spec.ts'],
  outputDir: '/tmp/otpguard-core-2-dkim-browser-results',
  workers: 1,
  use: { headless: true, trace: 'off', screenshot: 'off', video: 'off' },
});
