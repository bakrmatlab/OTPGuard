import { afterEach, expect, it, vi } from 'vitest';
import type { Adapter, Context } from '../apps/extension/pipeline/coordinator';
const captured = vi.hoisted(() => ({
  browser: null as Omit<Adapter, 'retrieve' | 'registry'> | null,
}));
vi.mock('../apps/extension/gmail/retrieval', () => ({
  createGmailPageCoordinator: (browser: typeof captured.browser) => {
    captured.browser = browser;
    return {
      status: () => ({ state: 'IDLE' }),
      cancelAll: vi.fn(),
      cancelTab: vi.fn(),
      recheckAll: vi.fn(),
    };
  },
}));
vi.mock('../apps/extension/gmail/worker', () => ({ gmailLifecycle: {} }));
vi.mock('../apps/extension/gmail/authenticated-worker', () => ({
  authenticatedMailbox: {},
}));
vi.mock('../apps/extension/account/worker', () => ({ accountGate: {} }));
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
async function setup(openPopup: () => Promise<void>) {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  const listener = { addListener: vi.fn() };
  vi.stubGlobal('chrome', {
    action: { openPopup },
    runtime: { getURL: (p: string) => 'chrome-extension://fixture/' + p },
    permissions: {
      contains: async () => true,
      onAdded: listener,
      onRemoved: listener,
    },
    scripting: { unregisterContentScripts: async () => {} },
    webNavigation: {
      getFrame: async () => ({
        documentId: 'doc',
        url: 'https://www.canva.com/login/',
      }),
      onCommitted: listener,
      onHistoryStateUpdated: listener,
    },
    tabs: {
      get: async () => ({ active: true, windowId: 17 }),
      onRemoved: listener,
      onActivated: listener,
    },
    windows: {
      getLastFocused: async () => ({ id: 17, focused: true }),
      onFocusChanged: listener,
    },
  });
  const worker = await import('../apps/extension/pipeline/worker');
  const context: Context = {
    accountId: 'synthetic',
    mailboxId: 'synthetic',
    tabId: 1,
    documentId: 'doc',
    origin: 'https://www.canva.com',
    browserUrl: 'https://www.canva.com/login/',
    policyUrl: 'https://www.canva.com/login/',
    serviceId: 'canva',
    foreground: true,
  };
  const binding = {
    requestId: 'request',
    groupId: 'fields',
    expectedLength: 6,
    expiresAt: 130000,
  };
  return { worker, context, binding, confirm: captured.browser!.confirm! };
}
it('keeps verified Fill available when Chrome rejects automatic popup opening, then reports exact confirmation expiry', async () => {
  const t = await setup(async () => {
    throw new Error('synthetic popup denied');
  });
  const result = t.confirm(
    t.context,
    t.binding,
    new AbortController().signal,
    true,
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(t.worker.pipelineStatus()).toMatchObject({
    state: 'READY',
    prompt: 'unavailable',
  });
  await vi.advanceTimersByTimeAsync(30000);
  expect(await result).toBe('confirmation-expired');
});
it('an old rejected openPopup promise cannot clear a newer pending confirmation', async () => {
  let reject!: () => void;
  const t = await setup(
    () =>
      new Promise<void>((_, fail) => {
        reject = () => fail(new Error('synthetic late rejection'));
      }),
  );
  const abort = new AbortController();
  const first = t.confirm(t.context, t.binding, abort.signal, true);
  await vi.advanceTimersByTimeAsync(0);
  abort.abort();
  expect(await first).toBe(false);
  const nextAbort = new AbortController();
  const next = t.confirm(
    t.context,
    { ...t.binding, requestId: 'next' },
    nextAbort.signal,
    false,
  );
  reject();
  await vi.advanceTimersByTimeAsync(0);
  expect(t.worker.pipelineStatus()).toMatchObject({
    state: 'READY',
    requestId: 'next',
  });
  nextAbort.abort();
  expect(await next).toBe(false);
});

it('targets the browser-derived request window when opening the automatic prompt', async () => {
  const open = vi.fn(async () => {});
  const t = await setup(open);
  Object.assign(chrome.tabs, {
    get: async () => ({ active: true, windowId: 17 }),
  });
  Object.assign(chrome.webNavigation, {
    getFrame: async () => ({ documentId: 'doc', url: t.context.browserUrl }),
  });
  Object.assign(chrome.permissions, { contains: async () => true });
  Object.assign(chrome.windows, {
    getLastFocused: async () => ({ id: 17, focused: true }),
  });
  const abort = new AbortController();
  const result = t.confirm(t.context, t.binding, abort.signal, true);
  await vi.advanceTimersByTimeAsync(0);
  expect(open).toHaveBeenCalledWith({ windowId: 17 });
  abort.abort();
  expect(await result).toBe(false);
});
