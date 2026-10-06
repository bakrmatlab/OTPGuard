import { expect, it } from 'vitest';
import { setupProgress } from '../packages/shared/setup-progress';
import type { BrowserSnapshot } from '../packages/shared/browser-management';
const snapshot: BrowserSnapshot = {
  mailbox: { state: 'CONNECTED' },
  siteAccess: false,
  settings: { state: 'LOCAL', autofillEnabled: true, blockedOrigins: [] },
  history: { state: 'LOCAL', count: 0 },
};
it('does not treat Gmail connection as website permission or readiness', () => {
  expect(setupProgress(false, snapshot).action).toBe('sign-in');
  expect(setupProgress(true, null).action).toBe('browser-status');
  expect(setupProgress(true, snapshot)).toMatchObject({
    step: 4,
    action: 'open-options',
  });
  expect(setupProgress(true, { ...snapshot, siteAccess: true }).action).toBe(
    'ready',
  );
});
it('requires confirmed Gmail connection and returns to setup after loss of permission', () => {
  for (const state of [
    'CONNECTING',
    'RECONNECT_REQUIRED',
    'ACCOUNT_CHANGED',
    'UNCONFIGURED',
    'CONNECT_FAILED',
  ]) {
    expect(
      setupProgress(true, { ...snapshot, siteAccess: true, mailbox: { state } })
        .action,
    ).toBe('gmail-connect');
  }
  expect(setupProgress(true, { ...snapshot, siteAccess: false }).action).toBe(
    'open-options',
  );
});
