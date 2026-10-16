import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url)), {
    gitignoreResolution: true,
  }),
  { ignores: ['**/next-env.d.ts', '.agents/skills/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/extension/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['scripts/**', 'tests/**', '*.{ts,mjs}'],
    languageOptions: { globals: { ...globals.node, Bun: 'readonly' } },
  },
  {
    files: ['**/*.tsx'],
    extends: [
      eslintReact.configs['recommended-typescript'],
      reactHooks.configs.flat.recommended,
    ],
    rules: { '@eslint-react/naming-convention-ref-name': 'off' },
  },
  // eslint-react cannot find React from the root under isolated installs, so it
  // would assume the latest version. Keep these in step with each app's react pin.
  {
    files: ['apps/extension/**/*.tsx'],
    settings: { 'react-x': { version: '18.3.1' } },
  },
  {
    files: ['apps/web/**/*.tsx'],
    settings: { 'react-x': { version: '19.2.4' } },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Plain anchors do full page loads today; switching to <Link> changes navigation.
      '@next/next/no-html-link-for-pages': 'warn',
    },
    settings: { next: { rootDir: 'apps/web/' } },
  },
);
