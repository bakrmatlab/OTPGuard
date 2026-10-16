import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'security', include: ['tests/**/*.test.ts'] },
});
