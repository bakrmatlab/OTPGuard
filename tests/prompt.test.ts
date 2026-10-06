import { afterEach, expect, it, vi } from 'vitest';
import type {
  Adapter,
  Context,
  CancellationReason,
} from '../apps/extension/pipeline/coordinator';
const captured = vi.hoisted(() => ({
  state: 'IDLE',
  live: null as {
    status: () => { state: string };
    cancelAll: (reason?: CancellationReason) => void;
  } | null,
  browser: null as Omit<Adapter, 'retrieve' | 'registry'> | null,
}));
vi.mock('../apps/extension/gmail/retrieval', () => ({
  createGmailPageCoordinator: (browser: typeof captured.browser) => {
    captured.browser = browser;
    return {
      status: () => captured.live?.status() ?? { state: captured.state },
      cancelAll: vi.fn((reason?: CancellationReason) =>
        captured.live?.cancelAll(reason),
      ),
      cancelTab: vi.fn(),
      recheckAll: vi.fn(),
    };
  },
}));
vi.mock('../apps/extension/gmail/worker', () => ({
  gmailLifecycle: {
    subscribe: () => () => {},
    snapshot: () => ({ state: 'CONNECTED', mailbox: 'synthetic' }),
  },
}));
vi.mock('../apps/extension/gmail/authenticated-worker', () => ({
  authenticatedMailbox: {},
}));
vi.mock('../apps/extension/account/worker', () => ({
  accountGate: { subscribe: () => () => {} },
}));
vi.mock('../apps/extension/settings/worker', () => ({
  localSettings: {
    snapshot: () => ({
      installationId: 'fixture',
      autofillEnabled: true,
      blockedOrigins: [] as string[],
    }),
    subscribe: () => () => {},
    available: () => true,
  },
}));
vi.mock('../apps/extension/activity/worker', () => ({ localHistory: {} }));
afterEach(() => {
  captured.state = 'IDLE';
  captured.live = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});
async function setup(openPopup: () => Promise<void>) {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  const listener = { addListener: vi.fn() };
  const activated = { addListener: vi.fn() };
  vi.stubGlobal('chrome', {
    action: { openPopup },
    runtime: {
      id: 'fixture',
      getURL: (p: string) => 'chrome-extension://fixture/' + p,
    },
    permissions: {
      contains: async () => true,
      onAdded: listener,
      onRemoved: listener,
    },
    scripting: {
      unregisterContentScripts: async () => {},
      registerContentScripts: vi.fn(async () => {}),
    },
    webNavigation: {
      getFrame: async () => ({
        documentId: 'doc',
        url: 'https://www.canva.com/login/',
      }),
      onCommitted: listener,
      onHistoryStateUpdated: listener,
    },
    tabs: {
      get: async () => ({ id: 1, active: true, windowId: 17 }),
      onRemoved: listener,
      onActivated: activated,
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
  return {
    worker,
    context,
    binding,
    activated,
    confirm: captured.browser!.confirm!,
  };
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
    get: async () => ({ id: 1, active: true, windowId: 17 }),
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

it('registers top-level HTTPS-wide detection only with the broad optional grant', async () => {
  const t = await setup(async () => {});
  const register = vi.mocked(chrome.scripting.registerContentScripts);
  await t.worker.registerSites();
  expect(register).toHaveBeenCalledWith([
    {
      id: 'otpguard-pilot',
      matches: ['https://*/*'],
      js: ['content.js'],
      runAt: 'document_idle',
      allFrames: false,
      persistAcrossSessions: true,
    },
  ]);
  register.mockClear();
  Object.assign(chrome.permissions, { contains: async () => false });
  await t.worker.registerSites();
  expect(register).not.toHaveBeenCalled();
});

it('unavailable local settings refuse an existing Fill approval', async () => {
  const t = await setup(async () => {});
  const controller = new AbortController();
  const result = t.confirm(t.context, t.binding, controller.signal, false);
  const { localSettings } = await import('../apps/extension/settings/worker');
  const available = vi.spyOn(localSettings, 'available').mockReturnValue(false);
  try {
    expect(await t.worker.acceptFill(t.binding.requestId)).toBe(false);
  } finally {
    available.mockRestore();
    controller.abort();
  }
  expect(await result).toBe(false);
});

it('admits a same-document SPA challenge using browser route metadata, then refuses later navigation', async () => {
  const t = await setup(async () => {});
  const url =
    'https://www.canva.com/sign-in/factor-one?redirect_url=https%3A%2F%2Ffixture.invalid';
  chrome.webNavigation.getFrame = vi.fn(
    async (): Promise<chrome.webNavigation.GetFrameResultDetails> => ({
      documentId: 'doc',
      url,
      documentLifecycle: 'active',
      errorOccurred: false,
      frameType: 'outermost_frame',
      parentFrameId: -1,
    }),
  );
  const sender: chrome.runtime.MessageSender = {
    id: 'fixture',
    frameId: 0,
    documentLifecycle: 'active',
    documentId: 'doc',
    tab: await chrome.tabs.get(1),
    url: 'https://www.canva.com/sign-in',
  };
  const bound = await captured.browser!.context(sender);
  expect(bound).toMatchObject({
    browserUrl: url,
    policyUrl: url,
    documentId: 'doc',
  });
  expect(await captured.browser!.current(bound!)).toBe(true);
  chrome.webNavigation.getFrame = vi.fn(
    async (): Promise<chrome.webNavigation.GetFrameResultDetails> => ({
      documentId: 'doc',
      url: 'https://www.canva.com/other-route',
      documentLifecycle: 'active',
      errorOccurred: false,
      frameType: 'outermost_frame',
      parentFrameId: -1,
    }),
  );
  expect(await captured.browser!.current(bound!)).toBe(false);
  expect(
    await captured.browser!.context({
      ...sender,
      documentId: 'different-document',
    }),
  ).toBeNull();
  expect(
    await captured.browser!.context({
      ...sender,
      url: 'https://other.fixture.invalid/sign-in',
    }),
  ).toBeNull();
  t.worker.pagePipeline.cancelAll();
});

it('hides the previous page status and timer when switching tabs', async () => {
  const t = await setup(async () => {});
  captured.browser!.progress!('filling');
  expect(t.worker.pipelineStatus()).toHaveProperty('progress');
  t.activated.addListener.mock.calls[0]![0]();
  expect(t.worker.pipelineStatus()).toEqual({ state: 'IDLE' });
});

it('reading a previous terminal status does not freeze a new admission clock', async () => {
  const t = await setup(async () => {});
  captured.state = 'FILLED';
  captured.browser!.contextFailure!(null);
  captured.browser!.progress!('account');
  t.worker.pipelineStatus();
  vi.setSystemTime(105000);
  captured.browser!.progress!('mailbox');
  captured.state = 'SEARCHING';
  expect(t.worker.pipelineStatus()).toMatchObject({
    progress: { stage: 'mailbox', elapsedSeconds: 5 },
  });
});
it('opens detection prompting before any code confirmation is available', async () => {
  const open = vi.fn(async () => {});
  const t = await setup(open);
  await captured.browser!.detected!(
    {
      id: 'fixture',
      frameId: 0,
      documentLifecycle: 'active',
      documentId: 'doc',
      tab: await chrome.tabs.get(1),
      url: t.context.browserUrl,
    },
    'fields-1',
    new AbortController().signal,
  );
  expect(open).toHaveBeenCalledExactlyOnceWith({ windowId: 17 });
  expect(t.worker.pipelineStatus().state).not.toBe('READY');
});
it('deduplicates early prompting for the same document and fields', async () => {
  const open = vi.fn(async () => {});
  const t = await setup(open);
  const sender: chrome.runtime.MessageSender = {
    id: 'fixture',
    frameId: 0,
    documentLifecycle: 'active',
    documentId: 'doc',
    tab: await chrome.tabs.get(1),
    url: t.context.browserUrl,
  };
  await Promise.all([
    captured.browser!.detected!(
      sender,
      'fields-1',
      new AbortController().signal,
    ),
    captured.browser!.detected!(
      sender,
      'fields-1',
      new AbortController().signal,
    ),
  ]);
  expect(open).toHaveBeenCalledTimes(1);
});
it.each([
  'aborted',
  'disabled',
  'blocked',
  'permission',
  'background',
  'sender',
  'document',
])('does not open early for %s detection', async (scenario) => {
  const open = vi.fn(async () => {});
  const t = await setup(open);
  const controller = new AbortController();
  const { localSettings } = await import('../apps/extension/settings/worker');
  const sender: chrome.runtime.MessageSender = {
    id: 'fixture',
    frameId: 0,
    documentLifecycle: 'active',
    documentId: 'doc',
    tab: await chrome.tabs.get(1),
    url: t.context.browserUrl,
  };
  if (scenario === 'aborted') controller.abort();
  if (scenario === 'disabled')
    vi.spyOn(localSettings, 'snapshot').mockReturnValue({
      version: 1,
      installationId: 'fixture',
      autofillEnabled: false,
      blockedOrigins: [],
    });
  if (scenario === 'blocked')
    vi.spyOn(localSettings, 'snapshot').mockReturnValue({
      version: 1,
      installationId: 'fixture',
      autofillEnabled: true,
      blockedOrigins: [t.context.origin],
    });
  if (scenario === 'permission')
    chrome.permissions.contains = vi.fn(async () => false);
  if (scenario === 'background')
    Object.assign(chrome.tabs, {
      get: async () => ({ ...sender.tab!, active: false }),
    });
  if (scenario === 'sender') sender.id = 'other-extension';
  if (scenario === 'document') sender.documentId = 'old-document';
  try {
    await captured.browser!.detected!(sender, 'fields-1', controller.signal);
  } finally {
    vi.restoreAllMocks();
  }
  expect(open).not.toHaveBeenCalled();
});

it('records a timely Fill click without waiting for the page query; release authority belongs to the coordinator', async () => {
  const t = await setup(async () => {});
  const controller = new AbortController();
  const result = t.confirm(t.context, t.binding, controller.signal, false);
  const read = vi.fn(
    async () =>
      new Promise<chrome.webNavigation.GetFrameResultDetails>(() => {}),
  );
  chrome.webNavigation.getFrame = read;
  vi.setSystemTime(129999);
  expect(await t.worker.acceptFill(t.binding.requestId)).toBe(true);
  expect(await result).toBe(true);
  expect(read).not.toHaveBeenCalled();
});

it('a status read expires suspended-worker confirmation even before its timer runs', async () => {
  const t = await setup(async () => {});
  const result = t.confirm(
    t.context,
    t.binding,
    new AbortController().signal,
    false,
  );
  vi.setSystemTime(130000);
  expect(t.worker.pipelineStatus().state).not.toBe('READY');
  expect(await result).toBe('confirmation-expired');
  expect(await t.worker.acceptFill(t.binding.requestId)).toBe(false);
});

it('finishes admission display when a browser admission is refused', async () => {
  const t = await setup(async () => {});
  const { createCoordinator } =
    await import('../apps/extension/pipeline/coordinator');
  const retrieve = vi.fn(async () => []);
  const coordinator = createCoordinator({
    ...captured.browser!,
    mode: 'user-confirmed',
    registry: [],
    retrieve,
    context: async () => ({ ...t.context, foreground: false }),
  });
  try {
    expect(
      await coordinator.handle(
        {
          type: 'detect',
          groupId: 'fields',
          expectedLength: 6,
          emailFlow: true,
          groupCount: 1,
          manual: true,
        },
        {},
      ),
    ).toEqual({ state: 'UNKNOWN', reason: 'request' });
    expect(t.worker.pipelineStatus().state).toBe('PAGE_UNAVAILABLE');
    vi.setSystemTime(217000);
    expect(t.worker.pipelineStatus().state).toBe('PAGE_UNAVAILABLE');
    expect(retrieve).not.toHaveBeenCalled();
  } finally {
    coordinator.dispose();
  }
});

it('uses the final browser foreground check when focus changes during admission', async () => {
  const t = await setup(async () => {});
  let checks = 0;
  Object.assign(chrome.windows, {
    getLastFocused: vi.fn(async () => ({ id: 17, focused: ++checks > 1 })),
  });
  const context = await captured.browser!.context({
    id: 'fixture',
    frameId: 0,
    documentLifecycle: 'active',
    documentId: 'doc',
    tab: await chrome.tabs.get(1),
    url: t.context.browserUrl,
  });
  // The baseline returned a false foreground snapshot after its final current check passed.
  // With one authoritative read the first attempt refuses; a subsequent focused attempt works.
  expect(context).toBeNull();
  const focused = await captured.browser!.context({
    id: 'fixture',
    frameId: 0,
    documentLifecycle: 'active',
    documentId: 'doc',
    tab: await chrome.tabs.get(1),
    url: t.context.browserUrl,
  });
  expect(focused?.foreground).toBe(true);
});

it('popup status expires stalled admission even before a suspended worker timer runs', async () => {
  const t = await setup(async () => {});
  captured.browser!.contextFailure!(null);
  captured.browser!.progress!('page');
  vi.setSystemTime(217000);
  expect(t.worker.pipelineStatus()).toMatchObject({
    state: 'CANCELLED',
    cancellation: 'deadline',
  });
});

it('status expiry aborts real stalled admission and ignores a late successful context', async () => {
  const t = await setup(async () => {});
  const { createCoordinator } =
    await import('../apps/extension/pipeline/coordinator');
  let finish!: (context: Context) => void;
  const retrieve = vi.fn(async () => []);
  const coordinator = createCoordinator({
    ...captured.browser!,
    mode: 'user-confirmed',
    registry: [],
    retrieve,
    context: () =>
      new Promise<Context>((resolve) => {
        finish = resolve;
      }),
  });
  captured.live = coordinator;
  try {
    const result = coordinator.handle(
      {
        type: 'detect',
        groupId: 'fields',
        expectedLength: 6,
        emailFlow: true,
        groupCount: 1,
        manual: true,
      },
      {},
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(t.worker.pipelineStatus().state).toBe('SEARCHING');
    vi.setSystemTime(217000);
    expect(t.worker.pipelineStatus()).toMatchObject({
      state: 'CANCELLED',
      cancellation: 'deadline',
    });
    expect(await result).toEqual({ state: 'CANCELLED' });
    finish(t.context);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.worker.pipelineStatus().state).toBe('CANCELLED');
    expect(retrieve).not.toHaveBeenCalled();
  } finally {
    coordinator.dispose();
  }
});

it('identifies the fresh account read after browser admission instead of leaving a page label', async () => {
  const t = await setup(async () => {});
  const { createConnectedCoordinator } =
    await import('../apps/extension/account/connected');
  const { createAccountGate } = await import('../apps/extension/account/gate');
  let reads = 0;
  let finish!: () => void;
  const gate = createAccountGate(async () => {
    if (++reads === 2)
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    return {
      userId: 'synthetic',
      sessionId: 'session',
      expiresAt: 1000000,
      label: 'Synthetic',
    };
  });
  const coordinator = createConnectedCoordinator(
    {
      ...captured.browser!,
      mode: 'user-confirmed',
      registry: [],
      retrieve: async () => [],
    },
    gate,
  );
  try {
    const result = coordinator.handle(
      {
        type: 'detect',
        groupId: 'fields',
        expectedLength: 6,
        emailFlow: true,
        groupCount: 1,
        manual: true,
      },
      {
        id: 'fixture',
        frameId: 0,
        documentLifecycle: 'active',
        documentId: 'doc',
        tab: await chrome.tabs.get(1),
        url: t.context.browserUrl,
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(reads).toBe(2);
    const status = t.worker.pipelineStatus();
    expect('progress' in status && status.progress?.stage).toBe('account');
    coordinator.cancelAll('navigation');
    expect(await result).toEqual({ state: 'CANCELLED' });
    finish();
    await vi.advanceTimersByTimeAsync(0);
  } finally {
    coordinator.dispose();
    gate.invalidate();
  }
});

it('status expiration retains the original challenge window for a fresh manual Retry', async () => {
  const t = await setup(async () => {});
  const { createCoordinator } =
    await import('../apps/extension/pipeline/coordinator');
  let reads = 0;
  let finish!: (value: Context) => void;
  const windows: number[] = [];
  const coordinator = createCoordinator({
    ...captured.browser!,
    mode: 'user-confirmed',
    registry: [],
    context: async () => {
      if (++reads === 2)
        return new Promise<Context>((resolve) => {
          finish = resolve;
        });
      return t.context;
    },
    retrieve: async (context) => {
      windows.push(context.requestWindow!.startedAt);
      return [];
    },
  });
  captured.live = coordinator;
  const detect = {
    type: 'detect',
    groupId: 'fields',
    expectedLength: 6,
    emailFlow: true,
    groupCount: 1,
    manual: true,
  };
  try {
    expect(await coordinator.handle(detect, {})).toEqual({ state: 'NO_CODE' });
    const stalled = coordinator.handle(detect, {});
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(217000);
    expect(t.worker.pipelineStatus().state).toBe('CANCELLED');
    expect(await stalled).toEqual({ state: 'CANCELLED' });
    finish(t.context);
    await vi.advanceTimersByTimeAsync(0);
    expect(await coordinator.handle(detect, {})).toEqual({ state: 'NO_CODE' });
    expect(windows).toEqual([100000, 100000]);
  } finally {
    coordinator.dispose();
  }
});
