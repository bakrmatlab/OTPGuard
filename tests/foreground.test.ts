import { afterEach, expect, it, vi } from 'vitest';
import { isForeground } from '../apps/extension/pipeline/foreground';
afterEach(() => vi.unstubAllGlobals());
it('recognizes a focused owned popup while preserving tab, window and document binding', async () => {
  let focused = true;
  let active = true;
  let currentWindow = 1;
  let context = true;
  const popup = {
    documentId: 'popup-document',
    documentUrl: 'chrome-extension://fixture/popup.html',
  };
  vi.stubGlobal('chrome', {
    tabs: { get: async () => ({ active, windowId: 1 }) },
    windows: {
      getLastFocused: async () => ({ id: currentWindow, focused: false }),
    },
    runtime: {
      getURL: (p: string) => 'chrome-extension://fixture/' + p,
      getContexts: async () => (context ? [popup] : []),
      sendMessage: async () => focused,
    },
  });
  expect(await isForeground(1)).toBe(true);
  focused = false;
  expect(await isForeground(1)).toBe(false);
  focused = true;
  active = false;
  expect(await isForeground(1)).toBe(false);
  active = true;
  currentWindow = 2;
  expect(await isForeground(1)).toBe(false);
  currentWindow = 1;
  context = false;
  expect(await isForeground(1)).toBe(false);
});
