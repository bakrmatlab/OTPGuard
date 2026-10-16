import { afterEach, expect, it, vi } from 'vitest';
const actions = vi.hoisted(() => ({
  settings: vi.fn(async () => ({ state: 'LOCAL' })),
  history: vi.fn(async () => ({ state: 'LOCAL' })),
  fill: vi.fn(async () => true),
  retry: vi.fn(async () => true),
  account: vi.fn(async () => ({ state: 'SIGNED_IN' })),
}));
vi.mock('../website-management-worker', () => ({}));
vi.mock('../pipeline/worker', () => ({
  pagePipeline: { handle: vi.fn() },
  pipelineStatus: () => ({ state: 'READY', requestId: 'synthetic' }),
  acceptFill: actions.fill,
  retryPage: actions.retry,
  confirmEmailRecovery: vi.fn(),
}));
vi.mock('../settings/worker', () => ({
  localSettings: {
    available: () => true,
    snapshot: () => ({ autofillEnabled: false }),
  },
  parseSettingsAction: (m: { type?: string }) =>
    m?.type === 'settings-status' ? m : null,
  settingsAction: actions.settings,
}));
vi.mock('../activity/worker', () => ({
  parseHistoryAction: (m: { type?: string }) =>
    m?.type === 'history-status' ? m : null,
  historyAction: actions.history,
}));
vi.mock('../gmail/authenticated-worker', () => ({
  authenticatedMailbox: {},
}));
vi.mock('../account/worker', () => ({
  accountStatus: actions.account,
  signOutAccount: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});
it('allows exact owned management reads while reserving pipeline actions for the popup', async () => {
  const listen = vi.fn();
  const origin = 'chrome-extension://synthetic-id/';
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'synthetic-id',
      getURL: (path: string) => origin + path,
      onMessage: { addListener: listen },
    },
  });
  await import('../background');
  const listener = listen.mock.calls[0]![0];
  const respond = vi.fn();
  const management = {
    id: 'synthetic-id',
    url: origin + 'management.html',
    tab: { id: 3 },
  };
  for (const type of ['settings-status', 'history-status', 'account-status'])
    expect(listener({ type }, management, respond)).toBe(true);
  await Promise.resolve();
  expect(actions.settings).toHaveBeenCalledOnce();
  expect(actions.history).toHaveBeenCalledOnce();
  expect(actions.account).toHaveBeenCalledOnce();
  for (const type of [
    'pipeline-fill',
    'pipeline-status',
    'pipeline-retry',
    'pipeline-confirm-email',
  ])
    expect(
      listener({ type, requestId: 'synthetic' }, management, respond),
    ).toBe(false);
  expect(actions.fill).not.toHaveBeenCalled();
  expect(actions.retry).not.toHaveBeenCalled();
  for (const wrong of [
    { ...management, id: 'foreign' },
    { ...management, url: 'https://otpguard.net/dashboard' },
    { ...management, url: management.url + '?forged=1' },
    { ...management, url: origin + 'arbitrary.html' },
  ])
    expect(listener({ type: 'settings-status' }, wrong, respond)).toBe(false);
  expect(
    listener(
      { type: 'pipeline-fill', requestId: 'synthetic' },
      { id: 'synthetic-id', url: origin + 'popup.html' },
      respond,
    ),
  ).toBe(true);
  expect(actions.fill).toHaveBeenCalledWith('synthetic');
});
