import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/*',
      'packages/*',
      // Repository checks that read build output or span several workspaces.
      { test: { name: 'repo', include: ['tests/*.test.ts'] } },
    ],
  },
});
