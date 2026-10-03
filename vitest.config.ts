import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  resolve: {
    // Resolve the isolated extension SDK consistently so worker tests can mock its boundary.
    alias: {
      '@clerk/chrome-extension/client': resolve(
        'apps/extension/node_modules/@clerk/chrome-extension/dist/esm/client/index.js',
      ),
    },
  },
  test: { include: ['tests/**/*.test.ts', 'apps/web/app/**/*.test.ts'] },
});
