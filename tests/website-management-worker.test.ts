import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  configured: true,
  current: true,
  frameDocument: 'doc-1',
  frameUrl: 'https://otpguard.net/dashboard',
  binding: { userId: 'user_test', sessionId: 'sess_test', generation: 0 },
  connect: vi.fn(async () => ({ state: 'CONNECTED' })),
  disconnect: vi.fn(async () => ({ state: 'DISCONNECTED' })),
  automatic: vi.fn(async () => {}),
  block: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
}));
vi.mock('../apps/extension/account/config', () => ({
  configuredAccount: () =>
    state.configured ? { webOrigin: 'https://otpguard.net' } : null,
}));
vi.mock('../apps/extension/account/worker', () => ({
  accountGate: {
    refresh: async () => state.binding,
    current: async () => state.current,
    matches: () => state.current,
  },
}));
vi.mock('../apps/extension/gmail/authenticated-worker', () => ({
  authenticatedMailbox: {
    connect: state.connect,
    disconnect: state.disconnect,
    check: async () => ({
      state: 'CONNECTED',
      mailbox: 'synthetic@fixture.invalid',
      token: 'secret-not-for-page',
    }),
  },
}));
vi.mock('../apps/extension/settings/worker', () => ({
  localSettings: { setAutofill: state.automatic, setBlock: state.block },
  settingsStatus: async () => ({
    state: 'LOCAL',
    autofillEnabled: true,
    blockedOrigins: [],
    installationId: 'extra-not-for-page',
  }),
}));
vi.mock('../apps/extension/activity/worker', () => ({
  localHistory: { clear: state.clear },
  historyAction: async (action: { type: string }) =>
    action.type === 'history-export'
      ? { state: 'LOCAL', json: '{"version":1,"events":[]}' }
      : { state: 'LOCAL', count: 0 },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
  state.configured = true;
  state.current = true;
  state.frameDocument = 'doc-1';
  state.frameUrl = 'https://otpguard.net/dashboard';
});
async function listener() {
  const listen = vi.fn();
  const options = vi.fn(async () => {});
  vi.stubGlobal('chrome', {
    runtime: {
      onMessageExternal: { addListener: listen },
      openOptionsPage: options,
    },
    webNavigation: {
      getFrame: async () => ({
        documentId: state.frameDocument,
        url: state.frameUrl,
      }),
    },
    permissions: { contains: async () => true },
  });
  await import('../apps/extension/website-management-worker');
  return {
    listen,
    options,
    async call(action: unknown) {
      const respond = vi.fn();
      expect(
        listen.mock.calls[0]?.[0](
          { version: 1, userId: 'user_test', sessionId: 'sess_test', action },
          {
            origin: 'https://otpguard.net',
            url: 'https://otpguard.net/dashboard',
            frameId: 0,
            documentId: 'doc-1',
            tab: { id: 3 },
          },
          respond,
        ),
      ).toBe(true);
      await vi.waitFor(() => expect(respond).toHaveBeenCalledOnce());
      return respond.mock.calls[0]?.[0];
    },
  };
}
it('registers no external listener for an unconfigured review build', async () => {
  state.configured = false;
  expect((await listener()).listen).not.toHaveBeenCalled();
});
it('projects only allowed metadata and exports only on explicit request', async () => {
  const l = await listener();
  const result = await l.call({ type: 'browser-status' });
  expect(result.state).toBe('CONNECTED');
  expect(result.exportJson).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain('secret-not-for-page');
  expect(JSON.stringify(result)).not.toContain('extra-not-for-page');
  expect((await l.call({ type: 'history-export' })).exportJson).toBe(
    '{"version":1,"events":[]}',
  );
});
it('dispatches the explicit controls with queued mutation guards and no pipeline path', async () => {
  const l = await listener();
  for (const action of [
    { type: 'settings-autofill', enabled: false },
    { type: 'settings-block', origin: 'https://example.com', blocked: true },
    { type: 'gmail-connect' },
    { type: 'gmail-disconnect' },
    { type: 'history-delete' },
    { type: 'open-options' },
  ])
    expect((await l.call(action)).state).toBe('CONNECTED');
  expect(state.automatic).toHaveBeenCalledWith(false, expect.any(Function));
  expect(state.block).toHaveBeenCalledWith(
    'https://example.com',
    true,
    expect.any(Function),
  );
  expect(state.connect).toHaveBeenCalledWith(expect.any(Function));
  expect(state.disconnect).toHaveBeenCalledOnce();
  expect(state.clear).toHaveBeenCalledWith(expect.any(Function));
  expect(l.options).toHaveBeenCalledOnce();
  expect(await l.call({ type: 'pipeline-fill', requestId: 'test' })).toEqual({
    state: 'REFUSED',
  });
});

it('reconnects after dashboard section navigation in the same document', async () => {
  state.frameUrl = 'https://otpguard.net/dashboard#settings';
  const l = await listener();
  expect((await l.call({ type: 'browser-status' })).state).toBe('CONNECTED');
});
it('still refuses a current frame on another route, origin or query', async () => {
  const l = await listener();
  for (const url of [
    'https://otpguard.net/help',
    'https://other.test/dashboard',
    'https://otpguard.net/dashboard?redirect=1',
    'http://otpguard.net/dashboard',
  ]) {
    state.frameUrl = url;
    expect((await l.call({ type: 'browser-status' })).state).toBe('REFUSED');
  }
});

it('refuses a replaced document even if its dashboard URL matches', async () => {
  state.frameDocument = 'replacement';
  const l = await listener();
  expect((await l.call({ type: 'browser-status' })).state).toBe('REFUSED');
});
