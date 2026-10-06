import { afterEach, expect, it, vi } from 'vitest';
const pipeline = vi.hoisted(() => ({
  cancelAll: vi.fn(),
  cancelTab: vi.fn(),
  recheckAll: vi.fn(async () => {}),
  status: () => ({ state: 'IDLE' }),
}));
vi.mock('../apps/extension/gmail/retrieval', () => ({
  createGmailPageCoordinator: () => pipeline,
}));
vi.mock('../apps/extension/gmail/worker', () => ({
  gmailLifecycle: { subscribe: () => () => {} },
}));
vi.mock('../apps/extension/account/worker', () => ({
  accountGate: { subscribe: () => () => {} },
}));
vi.mock('../apps/extension/gmail/authenticated-worker', () => ({
  authenticatedMailbox: { check: async () => ({ state: 'DISCONNECTED' }) },
}));
vi.mock('../apps/extension/settings/worker', () => ({
  localSettings: {
    snapshot: () => ({ installationId: 'fixture' }),
    subscribe: () => () => {},
    available: () => true,
  },
}));
vi.mock('../apps/extension/activity/worker', () => ({ localHistory: {} }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('rechecks current requests rather than cancelling them when a browser window gains focus', async () => {
  vi.useFakeTimers();
  const focus = vi.fn();
  const listener = { addListener: vi.fn() };
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: (p: string) => 'chrome-extension://fixture/' + p,
      getContexts: async () => [],
    },
    permissions: {
      contains: async () => false,
      onAdded: listener,
      onRemoved: listener,
    },
    scripting: { unregisterContentScripts: async () => {} },
    webNavigation: { onCommitted: listener, onHistoryStateUpdated: listener },
    tabs: { onRemoved: listener, onActivated: listener },
    windows: { onFocusChanged: { addListener: focus } },
  });
  await import('../apps/extension/pipeline/worker');
  const onFocus = focus.mock.calls[0]![0];
  onFocus(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(pipeline.cancelAll).not.toHaveBeenCalled();
  expect(pipeline.recheckAll).toHaveBeenCalledWith('focus-changed');
});
