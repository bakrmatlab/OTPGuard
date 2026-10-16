import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  // One status line plus failures keeps output small for coding agents and CI logs.
  reporter: 'line',
  use: { trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    {
      command: 'bun run --filter @otpguard/web start --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
    },
    {
      command: 'bun run fixtures',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: false,
    },
  ],
});
