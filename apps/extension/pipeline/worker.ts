import { createGmailPageCoordinator } from '../gmail/retrieval';
import { gmailLifecycle } from '../gmail/worker';
import { authenticatedMailbox } from '../gmail/authenticated-worker';
import { accountGate } from '../account/worker';
import { localSettings } from '../settings/worker';
import { supportedServices, normalizeOrigin } from '../../../packages/security';
import { createReleaseLedger } from './replay';
import { createActivityRecorder } from '../activity/record';
import { localHistory } from '../activity/worker';
import type { Binding } from './protocol';
import type { Context, CancellationReason } from './coordinator';
import { isForeground as foreground } from './foreground';

let cancellation: CancellationReason | undefined;
let contextFailure: 'account' | 'mailbox' | 'page' | null = null;
let retryFailure: 'NO_CHALLENGE' | 'CONTENT_UNAVAILABLE' | null = null;
let pending: {
  binding: Binding;
  context: Context;
  finish: (v: boolean) => void;
  prompt: 'requested' | 'unavailable' | 'manual';
} | null = null;
const ledger = createReleaseLedger({
  async read() {
    await chrome.storage.local.setAccessLevel({
      accessLevel: 'TRUSTED_CONTEXTS',
    });
    return (await chrome.storage.local.get('otpguard.release.v1'))[
      'otpguard.release.v1'
    ];
  },
  async write(v) {
    await chrome.storage.local.set({ 'otpguard.release.v1': v });
  },
});
const matches = supportedServices.flatMap((s) =>
  s.origins.map((o) => o + '/*'),
);
async function permitted(origin: string) {
  return chrome.permissions.contains({ origins: [origin + '/*'] });
}
async function current(context: Context) {
  const frame = await chrome.webNavigation.getFrame({
    tabId: context.tabId,
    frameId: 0,
  });
  return !!(
    frame &&
    frame.documentId === context.documentId &&
    frame.url === context.browserUrl &&
    normalizeOrigin(frame.url) === context.origin &&
    (await permitted(context.origin)) &&
    (await foreground(context.tabId))
  );
}
async function openBoundPopup(
  context: Context,
  valid: () => boolean = () => true,
) {
  const tab = await chrome.tabs.get(context.tabId);
  if (
    !tab.active ||
    tab.windowId === undefined ||
    !(await current(context)) ||
    !valid()
  )
    throw new Error('Prompt context unavailable');
  await chrome.action.openPopup({ windowId: tab.windowId });
}
export const pagePipeline = createGmailPageCoordinator(
  {
    now: Date.now,
    cancelled(reason) {
      cancellation = reason;
    },
    contextFailure(reason) {
      if (reason === null) cancellation = undefined;
      contextFailure = reason;
      retryFailure = null;
    },
    async unavailable(sender, automatic) {
      if (
        !automatic ||
        !['account', 'mailbox'].includes(contextFailure ?? '') ||
        !localSettings.available() ||
        !localSettings.snapshot().autofillEnabled ||
        sender.id !== chrome.runtime.id ||
        sender.frameId !== 0 ||
        sender.documentLifecycle !== 'active' ||
        !sender.documentId ||
        sender.tab?.id === undefined ||
        !sender.url
      )
        return;
      const origin = normalizeOrigin(sender.url);
      const policy = supportedServices.find((s) =>
        s.origins.includes(origin ?? ''),
      );
      if (
        !origin ||
        !policy ||
        localSettings.snapshot().blockedOrigins.includes(origin)
      )
        return;
      const context: Context = {
        accountId: '',
        mailboxId: '',
        tabId: sender.tab.id,
        documentId: sender.documentId,
        origin,
        browserUrl: sender.url,
        policyUrl: sender.url,
        serviceId: policy.id,
        foreground: true,
      };
      await openBoundPopup(context);
    },
    id: () => crypto.randomUUID(),
    settings: () =>
      localSettings.available()
        ? localSettings.snapshot()
        : {
            autofillEnabled: false,
            blockedOrigins: matches.map((m) => m.slice(0, -2)),
          },
    subscribeSettings: localSettings.subscribe,
    activity: createActivityRecorder(
      localHistory,
      () => localSettings.snapshot().installationId,
      supportedServices.map((s) => s.id),
    ),
    async context(sender) {
      await localSettings.initialized;
      if (
        sender.id !== chrome.runtime.id ||
        sender.frameId !== 0 ||
        sender.documentLifecycle !== 'active' ||
        !sender.documentId ||
        sender.tab?.id === undefined ||
        !sender.url
      ) {
        contextFailure = 'page';
        return null;
      }
      const origin = normalizeOrigin(sender.url);
      const policy = supportedServices.find((s) =>
        s.origins.includes(origin ?? ''),
      );
      const mailbox = gmailLifecycle.snapshot();
      if (
        !policy ||
        !origin ||
        mailbox.state !== 'CONNECTED' ||
        !mailbox.mailbox
      ) {
        contextFailure = mailbox.state !== 'CONNECTED' ? 'mailbox' : 'page';
        return null;
      }
      const context = {
        accountId: '',
        mailboxId: mailbox.mailbox,
        tabId: sender.tab.id,
        documentId: sender.documentId,
        origin,
        browserUrl: sender.url,
        policyUrl: sender.url,
        serviceId: policy.id,
        foreground: await foreground(sender.tab.id),
      };
      if (!(await current(context))) {
        contextFailure = 'page';
        return null;
      }
      return context;
    },
    current,
    send: (context, message) =>
      chrome.tabs.sendMessage(context.tabId, message, {
        documentId: context.documentId,
      }),
    reserve: (context, id) =>
      ledger.reserve(context.accountId, context.mailboxId, id),
    confirm(context, binding, signal, automatic) {
      if (pending) return Promise.resolve(false);
      return new Promise<boolean | 'confirmation-expired'>((resolve) => {
        let settled = false;
        const finish = (v: boolean | 'confirmation-expired') => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          if (pending?.binding === binding) pending = null;
          resolve(v);
        };
        const abort = () => finish(false);
        const timer = setTimeout(
          () => finish('confirmation-expired'),
          Math.max(0, binding.expiresAt - Date.now()),
        );
        pending = {
          context,
          binding,
          finish,
          prompt: automatic ? 'requested' : 'manual',
        };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        else if (automatic)
          void openBoundPopup(
            context,
            () => !settled && pending?.binding === binding,
          ).catch(() => {
            if (!settled && pending?.binding === binding)
              pending.prompt = 'unavailable';
          });
      });
    },
  },
  accountGate,
  gmailLifecycle,
  undefined,
  () =>
    gmailLifecycle.snapshot().state === 'CONNECTED'
      ? gmailLifecycle.check()
      : authenticatedMailbox.check(),
);

export function pipelineStatus() {
  return pending
    ? {
        state: 'READY',
        requestId: pending.binding.requestId,
        service: 'Canva',
        expiresAt: pending.binding.expiresAt,
        prompt: pending.prompt,
      }
    : retryFailure
      ? { state: retryFailure }
      : contextFailure
        ? {
            state: {
              account: 'ACCOUNT_UNAVAILABLE',
              mailbox: 'MAILBOX_UNAVAILABLE',
              page: 'PAGE_UNAVAILABLE',
            }[contextFailure],
          }
        : { ...pagePipeline.status(), cancellation };
}
export async function acceptFill(requestId: unknown) {
  const selected = pending;
  if (
    !selected ||
    selected.binding.requestId !== requestId ||
    Date.now() >= selected.binding.expiresAt ||
    !(await current(selected.context))
  )
    return false;
  if (pending !== selected) return false;
  selected.finish(true);
  return true;
}
export async function retryPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const origin = normalizeOrigin(tab?.url ?? '');
  if (
    !origin ||
    !supportedServices.some((s) => s.origins.includes(origin)) ||
    tab?.id === undefined ||
    !(await permitted(origin))
  )
    return false;
  contextFailure = null;
  retryFailure = null;
  try {
    const detected = await chrome.tabs.sendMessage(tab.id, {
      type: 'scan',
      manual: true,
    });
    if (detected !== true) retryFailure = 'NO_CHALLENGE';
    return detected === true;
  } catch {
    retryFailure = 'CONTENT_UNAVAILABLE';
    return false;
  }
}
export async function registerSites() {
  const allowed: string[] = [];
  for (const match of matches)
    if (await chrome.permissions.contains({ origins: [match] }))
      allowed.push(match);
  await chrome.scripting
    .unregisterContentScripts({ ids: ['otpguard-pilot'] })
    .catch(() => {});
  if (allowed.length)
    await chrome.scripting.registerContentScripts([
      {
        id: 'otpguard-pilot',
        matches: allowed,
        js: ['content.js'],
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
}
void registerSites().catch(() => {});
chrome.permissions.onRemoved.addListener(() => {
  pagePipeline.cancelAll('permissions-changed');
  void registerSites().catch(() => {});
});
chrome.permissions.onAdded.addListener(
  () => void registerSites().catch(() => {}),
);
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId === 0) pagePipeline.cancelTab(tabId);
});
chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, frameId }) => {
  if (frameId === 0) pagePipeline.cancelTab(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) =>
  pagePipeline.cancelTab(tabId, 'navigation'),
);
chrome.tabs.onActivated.addListener(() =>
  pagePipeline.cancelAll('tab-changed'),
);
chrome.windows.onFocusChanged.addListener(() => {
  // Popup mounting can briefly blur its browser window. Recheck actual request
  // authority after mounting rather than treating regained browser focus as loss.
  setTimeout(() => {
    void pagePipeline.recheckAll('focus-changed');
  }, 500);
});
