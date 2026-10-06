import { SEARCH_MS } from '../../../packages/security/timing';
import { createProgress } from './progress';
import { createEmailRecovery } from './email-recovery';
import {
  createGmailPageCoordinator,
  type RetrievalIssue,
} from '../gmail/retrieval';
import { gmailLifecycle } from '../gmail/worker';
import { authenticatedMailbox } from '../gmail/authenticated-worker';
import { accountGate } from '../account/worker';
import { localSettings } from '../settings/worker';
import { normalizeOrigin } from '../../../packages/security';
import { createReleaseLedger } from './replay';
import { createActivityRecorder } from '../activity/record';
import { localHistory } from '../activity/worker';
import type { Binding } from './protocol';
import type { Context, CancellationReason } from './coordinator';
import { isForeground as foreground } from './foreground';

const progress = createProgress();
let displayCurrent = true;
let admitting = false;
let admissionDeadline = 0;
let displayTab: number | undefined;
let detectionPromptKey: string | undefined;
function clearDisplay() {
  detectionPromptKey = undefined;
  emailRecovery.clear();
  displayCurrent = false;
  admitting = false;
  progress.reset();
}
let cancellation: CancellationReason | undefined;
let retrievalIssue: RetrievalIssue | undefined;
let contextFailure: 'account' | 'mailbox' | 'page' | null = null;
let retryFailure: 'NO_CHALLENGE' | 'CONTENT_UNAVAILABLE' | null = null;
let pending: {
  binding: Binding;
  context: Context;
  finish: (v: boolean | 'confirmation-expired') => void;
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
const matches = ['https://*/*'];
async function permitted(origin: string) {
  return (
    !!normalizeOrigin(origin) &&
    (await chrome.permissions.contains({ origins: matches })) &&
    chrome.permissions.contains({ origins: [origin + '/*'] })
  );
}
async function current(context: Context) {
  progress.update('page');
  const frame = await chrome.webNavigation.getFrame({
    tabId: context.tabId,
    frameId: 0,
  });
  return !!(
    frame &&
    localSettings.available() &&
    frame.documentId === context.documentId &&
    frame.url === context.browserUrl &&
    normalizeOrigin(frame.url) === context.origin &&
    (await permitted(context.origin)) &&
    (await foreground(context.tabId))
  );
}
const emailRecovery = createEmailRecovery({
  now: Date.now,
  id: () => crypto.randomUUID(),
  async current(context) {
    return (
      !!context.accountSession &&
      (await accountGate.current(context.accountSession)) &&
      gmailLifecycle.snapshot().state === 'CONNECTED' &&
      gmailLifecycle.snapshot().mailbox === context.mailboxId &&
      !localSettings.snapshot().blockedOrigins.includes(context.origin) &&
      (await current(context))
    );
  },
  async scan(context, groupId) {
    return (
      (await chrome.tabs.sendMessage(
        context.tabId,
        { type: 'confirm-email', groupId },
        { documentId: context.documentId },
      )) === true
    );
  },
});
accountGate.subscribe(emailRecovery.clear);
gmailLifecycle.subscribe(emailRecovery.clear);
localSettings.subscribe(emailRecovery.clear);
export const confirmEmailRecovery = emailRecovery.confirm;
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
    progress(stage) {
      if (stage === 'polling') admitting = false;
      progress.update(stage);
    },
    finished() {
      admitting = false;
      progress.freeze();
    },
    cancelled(reason) {
      cancellation = reason;
      admitting = false;
      progress.freeze();
    },
    contextFailure(reason) {
      if (reason === null) {
        emailRecovery.clear();
        displayCurrent = true;
        admitting = true;
        admissionDeadline = Date.now() + SEARCH_MS;
        progress.reset();
        cancellation = undefined;
        retrievalIssue = undefined;
      }
      if (reason !== null) {
        admitting = false;
        progress.freeze();
      }
      contextFailure = reason;
      retryFailure = null;
    },
    async detected(sender, groupId, signal) {
      await localSettings.initialized;
      if (
        signal.aborted ||
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
      if (!origin || localSettings.snapshot().blockedOrigins.includes(origin))
        return;
      const frame = await chrome.webNavigation.getFrame({
        tabId: sender.tab.id,
        frameId: 0,
      });
      if (
        signal.aborted ||
        !frame ||
        frame.documentId !== sender.documentId ||
        normalizeOrigin(frame.url) !== origin
      )
        return;
      const context: Context = {
        accountId: '',
        mailboxId: '',
        tabId: sender.tab.id,
        documentId: sender.documentId,
        origin,
        browserUrl: frame.url,
        policyUrl: frame.url,
        serviceId: 'generic',
        foreground: true,
      };
      const key = JSON.stringify([
        context.tabId,
        context.documentId,
        context.browserUrl,
        groupId,
      ]);
      if (
        !(await current(context)) ||
        signal.aborted ||
        detectionPromptKey === key
      )
        return;
      detectionPromptKey = key;
      displayTab = context.tabId;
      await openBoundPopup(
        context,
        () =>
          !signal.aborted &&
          detectionPromptKey === key &&
          localSettings.available() &&
          localSettings.snapshot().autofillEnabled &&
          !localSettings.snapshot().blockedOrigins.includes(origin),
      );
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
      if (!origin || localSettings.snapshot().blockedOrigins.includes(origin))
        return;
      const frame = await chrome.webNavigation.getFrame({
        tabId: sender.tab.id,
        frameId: 0,
      });
      if (
        !frame ||
        frame.documentId !== sender.documentId ||
        normalizeOrigin(frame.url) !== origin
      )
        return;
      const context: Context = {
        accountId: '',
        mailboxId: '',
        tabId: sender.tab.id,
        documentId: sender.documentId,
        origin,
        browserUrl: frame.url,
        policyUrl: frame.url,
        serviceId: 'generic',
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
            blockedOrigins: [],
          },
    subscribeSettings: localSettings.subscribe,
    activity: createActivityRecorder(
      localHistory,
      () => localSettings.snapshot().installationId,
      [],
    ),
    async context(sender, signal) {
      displayTab = sender.tab?.id;
      progress.update('page');
      await localSettings.initialized;
      if (signal?.aborted) return null;
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
      if (!localSettings.available()) {
        contextFailure = 'page';
        return null;
      }
      const origin = normalizeOrigin(sender.url);
      const mailbox = gmailLifecycle.snapshot();
      if (!origin || mailbox.state !== 'CONNECTED' || !mailbox.mailbox) {
        contextFailure = mailbox.state !== 'CONNECTED' ? 'mailbox' : 'page';
        return null;
      }
      const frame = await chrome.webNavigation.getFrame({
        tabId: sender.tab.id,
        frameId: 0,
      });
      if (signal?.aborted) return null;
      // Chrome's sender URL remains the document's initial URL after pushState.
      // Bind to live browser metadata only after exact document/origin validation.
      if (
        !frame ||
        frame.documentId !== sender.documentId ||
        normalizeOrigin(frame.url) !== origin
      ) {
        contextFailure = 'page';
        return null;
      }
      const context = {
        accountId: '',
        mailboxId: mailbox.mailbox,
        tabId: sender.tab.id,
        documentId: sender.documentId,
        origin,
        browserUrl: frame.url,
        policyUrl: frame.url,
        serviceId: 'generic',
        // current() below performs the final live foreground check. An earlier
        // focus snapshot can disagree when the owned popup opens in between.
        foreground: true,
      };
      if (!(await current(context))) {
        if (signal?.aborted) return null;
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
    async reserve(context, id) {
      const result = await ledger.reserveDetailed(
        context.accountId,
        context.mailboxId,
        id,
      );
      return result === 'reserved' ? true : result;
    },
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
  (issue) => {
    retrievalIssue = issue ?? undefined;
  },
);

export function pipelineStatus() {
  if (!displayCurrent) return { state: 'IDLE' };
  const recovery = emailRecovery.status();
  if (recovery) return recovery;
  // Admission is displayed before a coordinator request exists. Enforce its
  // deadline on status reads too: MV3 timers can be delayed by suspension.
  if (admitting && Date.now() >= admissionDeadline) {
    // status() expires pending admissions without clearing challenge windows.
    pagePipeline.status();
    cancellation = 'deadline';
    admitting = false;
    progress.freeze();
  }
  const value = admitting ? { state: 'SEARCHING' } : readPipelineStatus();
  return { ...value, progress: progress.snapshot() };
}
function readPipelineStatus() {
  if (pending && Date.now() >= pending.binding.expiresAt)
    pending.finish('confirmation-expired');
  return pending
    ? {
        state: 'READY',
        requestId: pending.binding.requestId,
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
        : cancellation === 'deadline'
          ? { state: 'CANCELLED', cancellation, retrievalIssue }
          : { ...pagePipeline.status(), cancellation, retrievalIssue };
}
export async function acceptFill(requestId: unknown) {
  const selected = pending;
  if (
    !selected ||
    selected.binding.requestId !== requestId ||
    Date.now() >= selected.binding.expiresAt ||
    !localSettings.available() ||
    localSettings.snapshot().blockedOrigins.includes(selected.context.origin)
  )
    return false;
  if (pending !== selected) return false;
  // Record the timely click now. The coordinator performs fresh account/mailbox/
  // browser checks under its separate release budget before sending any code.
  selected.finish(true);
  return true;
}
export async function retryPage() {
  emailRecovery.clear();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const origin = normalizeOrigin(tab?.url ?? '');
  if (!origin || tab?.id === undefined || !(await permitted(origin)))
    return false;
  contextFailure = null;
  retryFailure = null;
  try {
    displayCurrent = true;
    displayTab = tab.id;
    progress.reset();
    progress.update('detection');
    const frame = await chrome.webNavigation.getFrame({
      tabId: tab.id,
      frameId: 0,
    });
    if (!frame?.documentId || normalizeOrigin(frame.url) !== origin)
      return false;
    const detected = await chrome.tabs.sendMessage(
      tab.id,
      {
        type: 'scan',
        manual: true,
      },
      { documentId: frame.documentId },
    );
    if (
      detected &&
      typeof detected === 'object' &&
      Object.keys(detected).length === 2 &&
      detected.state === 'EMAIL_CONFIRMATION_REQUIRED'
    ) {
      const account = await accountGate.refresh(true);
      const mailbox =
        gmailLifecycle.snapshot().state === 'CONNECTED'
          ? await gmailLifecycle.check()
          : await authenticatedMailbox.check();
      if (!account || mailbox.state !== 'CONNECTED' || !mailbox.mailbox) {
        contextFailure = !account ? 'account' : 'mailbox';
        return false;
      }
      const context: Context = {
        accountId: account.userId,
        accountSession: account,
        mailboxId: mailbox.mailbox,
        tabId: tab.id,
        documentId: frame.documentId,
        origin,
        browserUrl: frame.url,
        policyUrl: frame.url,
        serviceId: 'generic',
        foreground: true,
      };
      if (
        !(await current(context)) ||
        localSettings.snapshot().blockedOrigins.includes(origin)
      )
        return false;
      return emailRecovery.offer(context, detected.groupId);
    }
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
  emailRecovery.clear();
  pagePipeline.cancelAll('permissions-changed');
  void registerSites().catch(() => {});
});
chrome.permissions.onAdded.addListener(
  () => void registerSites().catch(() => {}),
);
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId === 0) {
    pagePipeline.cancelTab(tabId);
    if (tabId === displayTab) clearDisplay();
  }
});
chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, frameId }) => {
  if (frameId === 0) {
    pagePipeline.cancelTab(tabId);
    if (tabId === displayTab) clearDisplay();
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  pagePipeline.cancelTab(tabId, 'navigation');
  if (tabId === displayTab) clearDisplay();
});
chrome.tabs.onActivated.addListener(() => {
  pagePipeline.cancelAll('tab-changed');
  clearDisplay();
});
chrome.windows.onFocusChanged.addListener(() => {
  // Popup mounting can briefly blur its browser window. Recheck actual request
  // authority after mounting rather than treating regained browser focus as loss.
  setTimeout(() => {
    void pagePipeline.recheckAll('focus-changed');
  }, 500);
});

chrome.webNavigation.onReferenceFragmentUpdated?.addListener(
  ({ tabId, frameId }) => {
    if (frameId === 0) {
      pagePipeline.cancelTab(tabId);
      if (tabId === displayTab) clearDisplay();
    }
  },
);
