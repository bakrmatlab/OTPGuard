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
it('history management is exact-popup only, cannot append from messages, restricts storage and exports/deletes', async () => {
  const records: Record<string, unknown> = {};
  const setAccessLevel = vi.fn(async () => {});
  const addListener = vi.fn();
  const url = 'chrome-extension://fixture/popup.html';
  vi.stubGlobal('chrome', {
    runtime: { id: 'fixture', getURL: () => url, onMessage: { addListener } },
    storage: {
      local: {
        setAccessLevel,
        get: async (key: string) => ({ [key]: records[key] }),
        set: async (value: Record<string, unknown>) => {
          Object.assign(records, value);
        },
      },
    },
  });
  await import('../apps/extension/background');
  const { localHistory, historyAction } =
    await import('../apps/extension/activity/worker');
  const event = {
    serviceId: null,
    action: 'FILL',
    result: 'FILLED',
    reason: 'none',
    time: Date.now(),
    installationId: '11111111-1111-4111-8111-111111111111',
  };
  await localHistory.append(event);
  const listener = addListener.mock.calls[0]![0];
  const sender = { id: 'fixture', url };
  const respond = vi.fn();
  for (const type of ['history-status', 'history-export', 'history-delete']) {
    for (const wrong of [
      { ...sender, id: 'foreign' },
      { ...sender, url: 'https://site.fixture.invalid' },
      { ...sender, url: url + '?x=1' },
    ])
      expect(listener({ type }, wrong, respond)).toBe(false);
    expect(listener({ type, owner: 'alice' }, sender, respond)).toBe(false);
  }
  expect(listener({ type: 'history-append', event }, sender, respond)).toBe(
    false,
  );
  expect(listener({ type: 'history-cloud-enable' }, sender, respond)).toBe(
    false,
  );
  expect(await historyAction({ type: 'history-status' })).toEqual({
    state: 'LOCAL',
    cloud: 'POLICY_UNRESOLVED',
    count: 1,
    lastAction: {
      result: event.result,
      reason: event.reason,
      time: event.time,
    },
  });
  const exported = await historyAction({ type: 'history-export' });
  expect(JSON.parse('json' in exported ? exported.json : '')).toEqual({
    version: 1,
    events: [event],
  });
  expect(await historyAction({ type: 'history-delete' })).toEqual({
    state: 'LOCAL',
    cloud: 'POLICY_UNRESOLVED',
    count: 0,
  });
  expect(setAccessLevel).toHaveBeenCalledWith({
    accessLevel: 'TRUSTED_CONTEXTS',
  });
  expect(records['otpguard.activity.v1']).toEqual({ version: 1, events: [] });
});
