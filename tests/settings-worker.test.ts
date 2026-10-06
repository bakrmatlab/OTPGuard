import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../apps/extension/pipeline/worker', () => ({
  pagePipeline: { handle: vi.fn(async () => ({ state: 'UNKNOWN' })) },
  pipelineStatus: () => ({ state: 'IDLE' }),
  acceptFill: async () => false,
  retryPage: async () => false,
}));
vi.mock('../apps/extension/gmail/worker', () => ({ gmailLifecycle: {} }));
vi.mock('../apps/extension/account/worker', () => ({
  accountGate: { subscribe: () => () => {} },
  accountStatus: async () => ({ state: 'UNCONFIGURED' }),
  signOutAccount: async () => {},
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('keeps settings and blocks in trusted local storage and only accepts the exact popup', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  let stored: unknown;
  const set = vi.fn(async (record: Record<string, unknown>) => {
    if ('otpguard.settings.v1' in record)
      stored = record['otpguard.settings.v1'];
  });
  const setAccessLevel = vi.fn(async () => {});
  const addListener = vi.fn();
  const url = 'chrome-extension://fixture/popup.html';
  vi.stubGlobal('crypto', { randomUUID: () => id });
  vi.stubGlobal('chrome', {
    runtime: { id: 'fixture', getURL: () => url, onMessage: { addListener } },
    storage: {
      local: {
        setAccessLevel,
        set,
        get: async () => ({ 'otpguard.settings.v1': stored }),
      },
    },
  });
  await import('../apps/extension/background');
  const { localSettings, settingsStatus, parseSettingsAction } =
    await import('../apps/extension/settings/worker');
  await localSettings.initialized;
  expect(setAccessLevel).toHaveBeenCalledWith({
    accessLevel: 'TRUSTED_CONTEXTS',
  });
  expect(stored).toEqual({
    version: 1,
    installationId: id,
    autofillEnabled: true,
    blockedOrigins: [],
  });
  const listener = addListener.mock.calls[0]![0];
  const respond = vi.fn();
  const sender = { id: 'fixture', url };
  for (const wrong of [
    { ...sender, id: 'foreign' },
    { ...sender, url: 'https://site.fixture.invalid' },
    { ...sender, url: url + '?forged=1' },
  ]) {
    expect(
      listener({ type: 'settings-autofill', enabled: true }, wrong, respond),
    ).toBe(false);
    expect(listener({ type: 'settings-status' }, wrong, respond)).toBe(false);
  }
  for (const wrong of [
    { type: 'settings-autofill', enabled: true, owner: 'forged' },
    { type: 'settings-autofill', enabled: 'true' },
    {
      type: 'settings-block',
      origin: 'https://site.fixture.invalid/login?synthetic=1',
      blocked: true,
    },
    {
      type: 'settings-block',
      origin: 'https://site.fixture.invalid',
      blocked: true,
      token: 'synthetic',
    },
    { type: 'settings-status', installationId: id },
    { type: 'sync-enable', enabled: true },
  ]) {
    expect(parseSettingsAction(wrong)).toBeNull();
    expect(listener(wrong, sender, respond)).toBe(false);
  }
  expect(
    listener({ type: 'settings-autofill', enabled: true }, sender, respond),
  ).toBe(true);
  await vi.waitFor(() =>
    expect(respond).toHaveBeenCalledWith({
      state: 'LOCAL',
      autofillEnabled: true,
      blockedOrigins: [],
      sync: 'UNCONFIGURED',
    }),
  );
  expect(await settingsStatus()).toEqual({
    state: 'LOCAL',
    autofillEnabled: true,
    blockedOrigins: [],
    sync: 'UNCONFIGURED',
  });
  expect(Object.keys(stored as object).sort()).toEqual([
    'autofillEnabled',
    'blockedOrigins',
    'installationId',
    'version',
  ]);
});
