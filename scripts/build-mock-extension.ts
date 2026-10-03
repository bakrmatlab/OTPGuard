// Separate opt-in artifact. Never modifies or overlays Plasmo production output.
const outdir = 'development/mock-extension/build';
const result = await Bun.build({
  entrypoints: [
    'development/mock-extension/background.ts',
    'development/mock-extension/content.ts',
    'development/mock-extension/popup.ts',
  ],
  target: 'browser',
  outdir,
});
if (!result.success) throw new Error('Mock extension build failed');
await Bun.write(
  `${outdir}/manifest.json`,
  JSON.stringify(
    {
      manifest_version: 3,
      name: 'OTPGuard — SYNTHETIC DEVELOPMENT ONLY',
      version: '0.0.0',
      permissions: ['webNavigation'],
      host_permissions: ['http://127.0.0.1:3001/*'],
      background: { service_worker: 'background.js' },
      action: { default_popup: 'popup.html' },
      content_scripts: [
        {
          matches: ['http://127.0.0.1:3001/pipeline*'],
          js: ['content.js'],
          run_at: 'document_idle',
          all_frames: false,
        },
      ],
    },
    null,
    2,
  ),
);
await Bun.write(
  `${outdir}/popup.html`,
  '<!doctype html><html><body><h1>OTPGuard synthetic demo</h1><p>Fabricated evidence. No Gmail or cloud accounts.</p><output>IDLE</output><script src="popup.js"></script></body></html>',
);
