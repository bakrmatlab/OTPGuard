// Parcel's pinned development server exposes project source to arbitrary browser
// origins, including on loopback. Keep this entry unavailable until repaired.
console.error(
  'Extension hot reload is disabled pending Parcel advisory GHSA-qm9p-f9j5-w83w repair. Run bun run build from the repository root and reload the unpacked production extension.',
);
process.exit(1);
