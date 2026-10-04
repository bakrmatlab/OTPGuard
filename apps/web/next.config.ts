import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
};
export default config;
