import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Only versions/help and configuration presence are inspected. Never print env
// values, auth output, mail, sessions or provider errors. This is an offline check.
const root = resolve(import.meta.dirname, '..');
const env = {
  ...process.env,
  CLERK_TELEMETRY_DISABLED: '1',
  CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: 'true',
  CLOUDSDK_CONFIG:
    process.env.CLOUDSDK_CONFIG ?? '/tmp/otpguard-runtime/gcloud-config',
};
let failed = false;
const check = (
  name: string,
  command: string,
  args: string[],
  required: boolean,
  expected?: string,
) => {
  const run = (flags: string[]) =>
    spawnSync(command, flags, {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 256 * 1024,
    });
  const version = run(args);
  const help = run(['--help']);
  // Version output is reduced to a numeric version, never echoed wholesale.
  const number = version.stdout?.match(/\d+\.\d+\.\d+/)?.[0];
  const ready =
    version.status === 0 &&
    help.status === 0 &&
    (!expected || number === expected);
  console.log(
    `${name}: ${ready ? `ready (${number ?? 'version available'})` : required ? 'FAILED' : 'optional / unavailable'}`,
  );
  if (required && !ready) failed = true;
};
check('Node', 'node', ['--version'], true, '22.19.0');
check('Bun', 'bun', ['--version'], true, '1.4.2');
check('Convex', resolve(root, 'node_modules/.bin/convex'), ['--version'], true);
check('Clerk', resolve(root, 'node_modules/.bin/clerk'), ['--version'], true);
check(
  'Playwright',
  resolve(root, 'node_modules/.bin/playwright'),
  ['--version'],
  true,
);
check('GitHub CLI', 'gh', ['--version'], false);
check(
  'Google Cloud SDK',
  process.env.OTPGUARD_GCLOUD_BIN ??
    '/tmp/otpguard-runtime/google-cloud-sdk/bin/gcloud',
  ['version'],
  false,
);
check(
  'Workspace CLI (optional; not used by extension)',
  process.env.OTPGUARD_GWS_BIN ?? '/tmp/otpguard-runtime/gws-cli/gws',
  ['--version'],
  false,
);
for (const file of [
  'apps/web/.env.local',
  'apps/extension/.env.account',
  'apps/extension/.env.gmail',
  '.env.local',
  '.clerk/config.json',
]) {
  console.log(
    `${file}: ${existsSync(resolve(root, file)) ? 'present (contents/validity not checked)' : 'absent'}`,
  );
}
console.log(
  'Authentication, resources, deployment and live integrations: NOT verified by this offline check.',
);
process.exitCode = failed ? 1 : 0;
