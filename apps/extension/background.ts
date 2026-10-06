import './website-management-worker';
import {
  pagePipeline,
  pipelineStatus,
  acceptFill,
  retryPage,
  confirmEmailRecovery,
} from './pipeline/worker';
import {
  parseSettingsAction,
  settingsAction,
  localSettings,
} from './settings/worker';
import { parseHistoryAction, historyAction } from './activity/worker';
import { authenticatedMailbox } from './gmail/authenticated-worker';
import { accountStatus, accountProbe, signOutAccount } from './account/worker';
// Exact owned popup confirms Fill; management is a separate owned page.
chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (
    sender.id === chrome.runtime.id &&
    sender.tab &&
    message &&
    typeof message === 'object' &&
    'type' in message &&
    ['challenge', 'detect', 'cancel'].includes(String(message.type))
  ) {
    void pagePipeline
      .handle(message, sender)
      .then(respond, () => respond({ state: 'ERROR' }));
    return true;
  }
  const popup = sender.url === chrome.runtime.getURL('popup.html');
  const management =
    !popup && sender.url === chrome.runtime.getURL('management.html');
  if (sender.id !== chrome.runtime.id || (!popup && !management)) return false;
  // Settings tabs never gain popup release, confirmation or retry authority.
  if (
    management &&
    message &&
    typeof message === 'object' &&
    'type' in message &&
    String(message.type).startsWith('pipeline-')
  )
    return false;
  if (message && typeof message === 'object' && 'type' in message) {
    if (
      message.type === 'pipeline-confirm-email' &&
      Object.keys(message).length === 2 &&
      'requestId' in message
    ) {
      void confirmEmailRecovery(message.requestId).then(respond, () =>
        respond(false),
      );
      return true;
    }
    if (
      message.type === 'pipeline-status' &&
      Object.keys(message).length === 1
    ) {
      respond(pipelineStatus());
      return false;
    }
    if (
      message.type === 'pipeline-fill' &&
      Object.keys(message).length === 2 &&
      'requestId' in message
    ) {
      void acceptFill(message.requestId).then(respond, () => respond(false));
      return true;
    }
    if (
      message.type === 'pipeline-retry' &&
      Object.keys(message).length === 1
    ) {
      void retryPage().then(respond, () => respond(false));
      return true;
    }
  }
  const history = parseHistoryAction(message);
  if (history) {
    void historyAction(history)
      .then(respond)
      .catch(() =>
        respond({ state: 'UNAVAILABLE', cloud: 'POLICY_UNRESOLVED' }),
      );
    return true;
  }
  const settings = parseSettingsAction(message);
  if (settings) {
    void settingsAction(settings)
      .then(respond)
      .catch(() => respond({ state: 'UNAVAILABLE', sync: 'UNCONFIGURED' }));
    return true;
  }
  if (
    !message ||
    typeof message !== 'object' ||
    Object.keys(message).length !== 1 ||
    !('type' in message)
  )
    return false;
  if (
    typeof message.type !== 'string' ||
    ![
      'account-status',
      'account-probe',
      'account-sign-out',
      'gmail-status',
      'gmail-connect',
      'gmail-disconnect',
    ].includes(message.type)
  )
    return false;
  const type = message.type;
  const action =
    message.type === 'gmail-connect'
      ? authenticatedMailbox.connect()
      : message.type === 'gmail-disconnect'
        ? authenticatedMailbox.disconnect()
        : message.type === 'gmail-status'
          ? authenticatedMailbox.check()
          : message.type === 'account-sign-out'
            ? signOutAccount().then(accountStatus)
            : message.type === 'account-probe'
              ? accountProbe()
              : accountStatus();
  void action
    .then(async (result) => {
      respond(result);
      if (
        type === 'gmail-connect' &&
        result.state === 'CONNECTED' &&
        localSettings.available() &&
        localSettings.snapshot().autofillEnabled
      )
        await retryPage().catch(() => false);
    })
    .catch(() =>
      respond({
        state: type.startsWith('gmail-')
          ? 'RECONNECT_REQUIRED'
          : message.type === 'account-sign-out'
            ? 'SIGN_OUT_FAILED'
            : 'SIGN_IN_REQUIRED',
      }),
    );
  return true;
});
