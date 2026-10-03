import {
  createCoordinator,
  type Context,
  type Envelope,
} from '../../apps/extension/pipeline/coordinator';
import type { ServicePolicy } from '../../packages/security';

// DEVELOPMENT ONLY: this is fabricated synthetic evidence, never Gmail attestation.
const registry: readonly ServicePolicy[] = [
  {
    id: 'mock-lantern',
    name: 'Synthetic Lantern',
    origins: ['https://lantern.example'],
    senders: [
      {
        address: 'codes@lantern.example',
        authenticatedDomain: 'lantern.example',
        boundaryId: 'development-fabricated',
        method: 'aligned-dkim',
      },
    ],
    templates: ['inline'],
    purposes: ['sign-in'],
    codeLengths: [6],
    maxAgeMs: 300_000,
    provenance: 'Fabricated local demo only',
    validatedOn: '2026-10-03',
  },
];
const allowed = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.origin === 'http://127.0.0.1:3001' &&
      /^\/pipeline(?:\/(safe|split|mismatch|unknown|ambiguous))?$/.test(
        parsed.pathname,
      )
      ? parsed
      : null;
  } catch {
    return null;
  }
};
async function foreground(tabId: number) {
  const [tab, window] = await Promise.all([
    chrome.tabs.get(tabId),
    chrome.windows.getLastFocused(),
  ]);
  return tab.active && window.focused && window.id === tab.windowId;
}
const coordinator = createCoordinator({
  registry,
  now: Date.now,
  id: () => crypto.randomUUID(),
  async context(sender) {
    if (
      sender.id !== chrome.runtime.id ||
      sender.frameId !== 0 ||
      !sender.documentId ||
      sender.documentLifecycle !== 'active' ||
      sender.tab?.id === undefined ||
      !sender.url
    )
      return null;
    const url = allowed(sender.url);
    if (!url) return null;
    const frame = await chrome.webNavigation.getFrame({
      tabId: sender.tab.id,
      frameId: 0,
    });
    if (
      !frame ||
      frame.documentId !== sender.documentId ||
      frame.url !== sender.url
    )
      return null;
    return {
      accountId: 'development-account',
      mailboxId: 'development-mailbox',
      tabId: sender.tab.id,
      documentId: sender.documentId,
      origin: url.origin,
      browserUrl: sender.url,
      foreground: await foreground(sender.tab.id),
      serviceId: 'mock-lantern',
      // Explicit dev-only loopback exception, destination chosen from browser URL.
      policyUrl: url.pathname.endsWith('/mismatch')
        ? 'https://unrelated.example'
        : 'https://lantern.example',
    };
  },
  async current(context) {
    const frame = await chrome.webNavigation.getFrame({
      tabId: context.tabId,
      frameId: 0,
    });
    return Boolean(
      context.accountId === 'development-account' &&
      context.mailboxId === 'development-mailbox' &&
      frame &&
      frame.documentId === context.documentId &&
      frame.url === context.browserUrl &&
      allowed(frame.url)?.origin === context.origin &&
      (await foreground(context.tabId)),
    );
  },
  async retrieve(context: Context, signal) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 800);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('cancelled'));
        },
        { once: true },
      );
    });
    const frame = await chrome.webNavigation.getFrame({
      tabId: context.tabId,
      frameId: 0,
    });
    if (!frame || frame.documentId !== context.documentId) return null;
    const path = allowed(frame.url)?.pathname;
    const message: Envelope = {
      messageId: 'synthetic-message',
      mailboxId: context.mailboxId,
      receivedAt: Date.now(),
      email: { subject: 'Sign in', text: 'Your verification code is 042681' },
      sender: path?.endsWith('/unknown')
        ? { status: 'unknown' }
        : {
            status: 'authenticated',
            messageId: 'synthetic-message',
            mailboxId: context.mailboxId,
            address: 'codes@lantern.example',
            authenticatedDomain: 'lantern.example',
            boundaryId: 'development-fabricated',
            method: 'aligned-dkim',
            delivery: 'direct',
          },
    };
    return path?.endsWith('/ambiguous')
      ? [
          message,
          {
            ...message,
            messageId: 'second-synthetic-message',
            sender:
              message.sender.status === 'authenticated'
                ? { ...message.sender, messageId: 'second-synthetic-message' }
                : message.sender,
          },
        ]
      : [message];
  },
  send: (context, message) =>
    chrome.tabs.sendMessage(context.tabId, message, {
      documentId: context.documentId,
    }),
});
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  if (
    sender.id === chrome.runtime.id &&
    sender.url === chrome.runtime.getURL('popup.html') &&
    message &&
    typeof message === 'object' &&
    Object.keys(message).length === 1 &&
    'type' in message &&
    message.type === 'status'
  ) {
    reply(coordinator.status());
    return false;
  }
  void coordinator
    .handle(message, sender)
    .then(reply, () => reply({ state: 'ERROR' }));
  return true;
});
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId === 0) coordinator.cancelTab(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => coordinator.cancelTab(tabId));
chrome.tabs.onActivated.addListener(() => coordinator.cancelAll());
chrome.windows.onFocusChanged.addListener(() => coordinator.cancelAll());

chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, frameId }) => {
  if (frameId === 0) coordinator.cancelTab(tabId);
});
