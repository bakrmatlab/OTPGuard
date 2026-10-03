import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// Reuse the SDK prepared by the separate setup chat. A stable installation can
// override this temporary path; no shell/profile changes or downloads are made.
const binary =
  process.env.OTPGUARD_GCLOUD_BIN ??
  '/tmp/otpguard-runtime/google-cloud-sdk/bin/gcloud';
if (!existsSync(binary)) {
  console.error(
    'Set OTPGUARD_GCLOUD_BIN to an installed Google Cloud SDK binary.',
  );
  process.exit(1);
}
const args = process.argv.slice(2);
const result = spawnSync(binary, args.length ? args : ['--help'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: 'true',
    CLOUDSDK_CONFIG:
      process.env.CLOUDSDK_CONFIG ?? '/tmp/otpguard-runtime/gcloud-config',
  },
});
process.exit(result.status ?? 1);
