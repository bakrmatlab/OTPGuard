import { afterEach, expect, it, vi } from 'vitest';
import type { LocalStatus } from '../apps/extension/pipeline/coordinator';
const handle = vi.hoisted(() =>
  vi.fn<
    (
      value: unknown,
      sender: chrome.runtime.MessageSender,
    ) => Promise<LocalStatus>
  >(async () => ({ state: 'IDLE' })),
);
vi.mock('../apps/extension/pipeline/worker', () => ({
  pagePipeline: { handle },
  pipelineStatus: vi.fn(),
  acceptFill: vi.fn(),
  retryPage: vi.fn(),
}));
vi.mock('../apps/extension/settings/worker', () => ({
  parseSettingsAction: vi.fn(),
  settingsAction: vi.fn(),
  localSettings: {},
}));
vi.mock('../apps/extension/activity/worker', () => ({
  parseHistoryAction: vi.fn(),
  historyAction: vi.fn(),
}));
vi.mock('../apps/extension/gmail/authenticated-worker', () => ({
  authenticatedMailbox: {},
}));
vi.mock('../apps/extension/account/worker', () => ({
  accountStatus: vi.fn(),
  accountProbe: vi.fn(),
  signOutAccount: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  handle.mockClear();
});
it('forwards early challenge messages through the production listener only from this extension page', async () => {
  const addListener = vi.fn();
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'fixture-extension',
      getURL: (path: string) => 'chrome-extension://fixture-extension/' + path,
      onMessage: { addListener },
    },
  });
  await import('../apps/extension/background');
  const listener = addListener.mock.calls[0]![0];
  const message = { type: 'challenge' };
  const sender = { id: 'fixture-extension', tab: { id: 1 } };
  const reply = vi.fn();
  expect(listener(message, sender, reply)).toBe(true);
  await Promise.resolve();
  expect(handle).toHaveBeenCalledWith(message, sender);
  expect(reply).toHaveBeenCalledWith({ state: 'IDLE' });
  handle.mockClear();
  expect(listener(message, { ...sender, id: 'other-extension' }, reply)).toBe(
    false,
  );
  expect(handle).not.toHaveBeenCalled();
});

it('carries an early request across a delayed unfamiliar-site form through the actual listener', async () => {
  const { createCoordinator } =
    await import('../apps/extension/pipeline/coordinator');
  let now = 100000;
  let origin = 'https://www.canva.com';
  let documentId = 'canva-document';
  let receivedAt = now;
  const send = vi.fn(async () => true);
  const coordinator = createCoordinator({
    mode: 'user-confirmed',
    registry: [],
    now: () => now,
    id: () => documentId,
    context: async () => ({
      accountId: 'user',
      mailboxId: 'person@fixture.invalid',
      tabId: 1,
      documentId,
      origin,
      browserUrl: origin + '/sign-in/factor-one',
      policyUrl: origin + '/sign-in/factor-one',
      serviceId: 'generic',
      foreground: true,
    }),
    current: async () => true,
    retrieve: async () => [
      {
        messageId: documentId,
        mailboxId: 'person@fixture.invalid',
        receivedAt,
        sender: { status: 'unknown' },
        email: { subject: 'Login code', text: 'Your code is 003719' },
      },
    ],
    confirm: async () => true,
    send,
  });
  handle.mockImplementation(coordinator.handle);
  const addListener = vi.fn();
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'fixture-extension',
      getURL: (path: string) => 'chrome-extension://fixture-extension/' + path,
      onMessage: { addListener },
    },
  });
  await import('../apps/extension/background');
  const listener = addListener.mock.calls[0]![0];
  const sender = { id: 'fixture-extension', tab: { id: 1 } };
  const route = (message: unknown) =>
    new Promise((resolve) => {
      expect(listener(message, sender, resolve)).toBe(true);
    });
  const detect = {
    type: 'detect',
    groupId: 'fields',
    expectedLength: 6,
    emailFlow: true,
    groupCount: 1,
  };
  try {
    expect(await route(detect)).toEqual({ state: 'FILLED' });
    origin = 'https://unfamiliar.fixture.invalid';
    documentId = 'unfamiliar-document';
    now += 10000;
    expect(await route({ type: 'challenge' })).toEqual({ state: 'FILLED' });
    receivedAt = now + 1000;
    now += 90000;
    expect(await route({ ...detect, groupId: 'nested-input' })).toEqual({
      state: 'FILLED',
    });
    expect(send).toHaveBeenCalledTimes(4);
  } finally {
    coordinator.dispose();
  }
});
