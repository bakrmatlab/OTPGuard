import { afterEach, expect, it, vi } from 'vitest';
import { sendBrowserAction } from './browser-transport';
import domainAuth from '../../../configuration/domain-auth.json';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('sends only version, selected session identifiers and the explicit action to the reviewed extension', async () => {
  const runtime = {
    sendMessage: vi.fn((_id, _message, callback) =>
      callback({ state: 'REFUSED' }),
    ),
  };
  vi.stubGlobal('window', { chrome: { runtime } });
  expect(
    await sendBrowserAction(
      { type: 'browser-status' },
      'user_test',
      'sess_test',
    ),
  ).toEqual({ state: 'REFUSED' });
  expect(runtime.sendMessage.mock.calls[0]?.slice(0, 2)).toEqual([
    domainAuth.extensionId,
    {
      version: 1,
      userId: 'user_test',
      sessionId: 'sess_test',
      action: { type: 'browser-status' },
    },
  ]);
});
it('handles absent or outdated extensions without inventing connected data', async () => {
  vi.stubGlobal('window', {});
  await expect(
    sendBrowserAction({ type: 'browser-status' }, 'user_test', 'sess_test'),
  ).rejects.toThrow('EXTENSION_MISSING');
  vi.stubGlobal('window', {
    chrome: {
      runtime: {
        lastError: { message: 'private diagnostic' },
        sendMessage: (
          _id: string,
          _request: unknown,
          callback: (value: undefined) => void,
        ) => callback(undefined),
      },
    },
  });
  await expect(
    sendBrowserAction({ type: 'browser-status' }, 'user_test', 'sess_test'),
  ).rejects.toThrow('EXTENSION_MISSING');
});
it('bounds a nonresponding extension request', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { chrome: { runtime: { sendMessage: vi.fn() } } });
  const result = expect(
    sendBrowserAction({ type: 'history-delete' }, 'user_test', 'sess_test'),
  ).rejects.toThrow('TIMED_OUT');
  await vi.advanceTimersByTimeAsync(90_000);
  await result;
});
