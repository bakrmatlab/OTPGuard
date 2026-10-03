// Test-only local harness: never imported by either application.
const build = await Bun.build({
  entrypoints: ['tests/fixtures/harness.ts'],
  target: 'browser',
});
if (!build.success) throw new Error('Fixture harness build failed');
Bun.serve({
  hostname: '127.0.0.1',
  port: 3001,
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/harness.js')
      return new Response(build.outputs[0], {
        headers: { 'content-type': 'text/javascript' },
      });
    if (path === '/')
      return new Response(Bun.file('tests/fixtures/detection.html'));
    return new Response('Not found', { status: 404 });
  },
});
