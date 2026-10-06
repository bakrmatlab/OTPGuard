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
  for (const [state, action] of Object.entries({
    DISCONNECTED: 'gmail-connect',
    CONNECT_FAILED: 'gmail-connect',
    SCOPE_REQUIRED: 'gmail-connect',
    RECONNECT_REQUIRED: 'gmail-connect',
    CONNECTING: 'browser-status',
    DISCONNECTING: 'browser-status',
    ACCOUNT_CHANGED: 'open-options',
    MAILBOX_CHANGED: 'open-options',
    SIGN_IN_REQUIRED: 'open-options',
    UNCONFIGURED: 'open-options',
    DISCONNECTED_REVOCATION_UNCONFIRMED: 'open-options',
    DISCONNECTED_CACHE_CLEAR_FAILED: 'open-options',
    UNKNOWN: 'browser-status',
  })) {
    const progress = setupProgress(true, {
      ...snapshot,
      siteAccess: true,
      mailbox: { state },
    });
    expect(progress.action).toBe(action);
    expect(progress.title).not.toBe('Setup complete');
    expect(progress.detail.length).toBeGreaterThan(0);
  }
  expect(setupProgress(true, { ...snapshot, siteAccess: false }).action).toBe(
    'open-options',
  );
});

it('recognizes existing setup, manual finding, loading and unavailable local settings', () => {
  const connected = { ...snapshot, siteAccess: true };
  expect(setupProgress(true, connected)).toMatchObject({
    title: 'Setup complete',
    action: 'ready',
  });
  expect(
    setupProgress(true, {
      ...connected,
      settings: { ...snapshot.settings, autofillEnabled: false },
    }).detail,
  ).toContain('Automatic finding is off');
  expect(
    setupProgress(true, {
      ...connected,
      settings: { ...snapshot.settings, state: 'UNAVAILABLE' },
    }).action,
  ).toBe('open-options');
  expect(setupProgress(false, null, true).title).toBe('Checking setup…');
});
