import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'web', include: ['tests/**/*.test.ts'] },
});
