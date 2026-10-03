import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: { trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: 'bun run --filter @otpguard/web start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
  },
});
