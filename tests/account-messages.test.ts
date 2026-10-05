import { afterEach, expect, it, vi } from 'vitest';
const retry = vi.hoisted(() => vi.fn(async () => true));
const preferences = vi.hoisted(() => ({ available: true, automatic: false }));
vi.mock('../apps/extension/settings/worker', () => ({
  localSettings: {
    available: () => preferences.available,
    snapshot: () => ({ autofillEnabled: preferences.automatic }),
  },
  parseSettingsAction: () => null,
  settingsAction: async () => null,
}));
vi.mock('../apps/extension/pipeline/worker', () => ({
  pagePipeline: { handle: vi.fn(async () => ({ state: 'UNKNOWN' })) },
  pipelineStatus: () => ({ state: 'IDLE' }),
  acceptFill: async () => false,
  retryPage: retry,
}));
const gmail = vi.hoisted(() => ({
  snapshot: vi.fn<() => { state: string; mailbox?: string }>(() => ({
    state: 'DISCONNECTED',
  })),
  invalidate: vi.fn(),
  check: vi.fn(async () => ({ state: 'DISCONNECTED' })),
  connect: vi.fn(async () => ({
    state: 'CONNECTED',
    mailbox: 'mailbox@fixture.invalid',
  })),
  disconnect: vi.fn(async () => ({ state: 'DISCONNECTED' })),
}));
vi.mock('../apps/extension/gmail/worker', () => ({ gmailLifecycle: gmail }));
const account = vi.hoisted(() => ({
  status: vi.fn(async () => ({
    state: 'SIGNED_IN',
    userId: 'synthetic-user',
    label: 'Synthetic',
  })),
  signOut: vi.fn(async () => {}),
}));
vi.mock('../apps/extension/account/worker', () => ({
  accountStatus: account.status,
  signOutAccount: account.signOut,
  accountGate: {
    subscribe: vi.fn(),
    refresh: async () => ({
      userId: 'synthetic-user',
      sessionId: 'session',
      generation: 0,
    }),
    current: async () => true,
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('accepts only closed account UI requests from the exact owned popup', async () => {
  const addListener = vi.fn();
  const url = 'chrome-extension://synthetic-id/popup.html';
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'synthetic-id',
      getURL: () => url,
      onMessage: { addListener },
    },
  });
  await import('../apps/extension/background');
  const listener = addListener.mock.calls[0]![0];
  const respond = vi.fn();
  const sender = { id: 'synthetic-id', url };
  for (const wrong of [
    { ...sender, url: 'https://page.fixture.invalid', tab: { id: 1 } },
    { ...sender, id: 'other' },
    { ...sender, url: url + '?page=1' },
    { ...sender, url: 'https://app.fixture.invalid' },
  ]) {
    expect(listener({ type: 'account-sign-out' }, wrong, respond)).toBe(false);
    expect(listener({ type: 'gmail-connect' }, wrong, respond)).toBe(false);
  }
  expect(
    listener({ type: 'account-status', userId: 'forged' }, sender, respond),
  ).toBe(false);
  expect(listener({ type: 'get-token' }, sender, respond)).toBe(false);
  expect(
    listener({ type: 'gmail-connect', token: 'forged' }, sender, respond),
  ).toBe(false);
  expect(gmail.connect).not.toHaveBeenCalled();
  expect(account.signOut).not.toHaveBeenCalled();
  expect(
    listener(
      { type: 'account-status' },
      { ...sender, tab: { id: 1 } },
      respond,
    ),
  ).toBe(true);
  await Promise.resolve();
  expect(respond).toHaveBeenCalledWith({
    state: 'SIGNED_IN',
    userId: 'synthetic-user',
    label: 'Synthetic',
  });
  gmail.snapshot.mockReturnValueOnce({ state: 'DISCONNECTED' });
  gmail.snapshot.mockReturnValueOnce({
    state: 'CONNECTED',
    mailbox: 'mailbox@fixture.invalid',
  });
  expect(listener({ type: 'gmail-connect' }, sender, respond)).toBe(true);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(respond).toHaveBeenCalledWith({
    state: 'CONNECTED',
    mailbox: 'mailbox@fixture.invalid',
  });
  account.signOut.mockRejectedValueOnce(new Error('synthetic signout failure'));
  expect(listener({ type: 'account-sign-out' }, sender, respond)).toBe(true);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(respond).toHaveBeenCalledWith({ state: 'SIGN_OUT_FAILED' });
  gmail.check.mockRejectedValueOnce(new Error('synthetic worker failure'));
  expect(listener({ type: 'gmail-status' }, sender, respond)).toBe(true);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(respond).toHaveBeenLastCalledWith({ state: 'RECONNECT_REQUIRED' });
});

it('rescans after explicit Gmail connection only when automatic prompting is available and enabled', async () => {
  for (const [available, automatic, expected] of [
    [true, true, 1],
    [true, false, 0],
    [false, true, 0],
  ] as const) {
    preferences.available = available;
    preferences.automatic = automatic;
    retry.mockClear();
    const addListener = vi.fn();
    const url = 'chrome-extension://synthetic-id/popup.html';
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'synthetic-id',
        getURL: () => url,
        onMessage: { addListener },
      },
    });
    vi.resetModules();
    await import('../apps/extension/background');
    gmail.snapshot.mockReturnValue({
      state: 'CONNECTED',
      mailbox: 'mailbox@fixture.invalid',
    });
    const respond = vi.fn();
    const listener = addListener.mock.calls[0]![0];
    expect(
      listener({ type: 'gmail-connect' }, { id: 'synthetic-id', url }, respond),
    ).toBe(true);
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(respond).toHaveBeenCalledWith({
      state: 'CONNECTED',
      mailbox: 'mailbox@fixture.invalid',
    });
    expect(retry).toHaveBeenCalledTimes(expected);
  }
});
