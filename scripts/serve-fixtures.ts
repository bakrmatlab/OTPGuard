// Test-only local harness: never imported by either application.
const build = await Bun.build({
  entrypoints: ['tests/fixtures/harness.ts', 'tests/fixtures/insertion.ts'],
  target: 'browser',
  plugins: [
    {
      name: 'fixture-react-18',
      setup(builder) {
        builder.onResolve({ filter: /^react(?:-dom)?(?:\/.*)?$/ }, (args) => ({
          path: Bun.resolveSync(
            args.path,
            `${import.meta.dir}/../apps/extension`,
          ),
        }));
      },
    },
  ],
});
if (!build.success) throw new Error('Fixture harness build failed');
Bun.serve({
  hostname: '127.0.0.1',
  port: 3001,
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (/^\/pipeline(?:\/(safe|split|mismatch|unknown|ambiguous))?$/.test(path))
      return new Response(
        `<!doctype html><html><head><title>Synthetic pipeline fixture</title></head><body><h1>Synthetic secure pipeline</h1><form><p>Verification code sent to your email</p>${Array.from({ length: path.endsWith('/split') ? 6 : 1 }, () => `<input autocomplete="one-time-code" inputmode="numeric" maxlength="${path.endsWith('/split') ? 1 : 6}">`).join('')}<button type="submit">Submit</button></form><output id="submissions">0</output><script>document.querySelector('form').addEventListener('submit', e => {e.preventDefault();document.querySelector('output').textContent='1';});</script></body></html>`,
        { headers: { 'content-type': 'text/html' } },
      );
    if (path === '/harness.js')
      return new Response(build.outputs[0], {
        headers: { 'content-type': 'text/javascript' },
      });
    if (path === '/insertion.js')
      return new Response(build.outputs[1], {
        headers: { 'content-type': 'text/javascript' },
      });
    if (path === '/insertion')
      return new Response(Bun.file('tests/fixtures/insertion.html'));
    if (path === '/')
      return new Response(Bun.file('tests/fixtures/detection.html'));
    return new Response('Not found', { status: 404 });
  },
});
