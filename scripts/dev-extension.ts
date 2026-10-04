// No source-serving extension dev server. Use explicit production build/reload.
console.error(
  'Extension hot reload is unavailable. Run bun run build from the repository root and reload the unpacked production extension.',
);
process.exit(1);
