import { parseSettingsAction, settingsAction } from './settings/worker';
import { parseHistoryAction, historyAction } from './activity/worker';
import { gmailLifecycle } from './gmail/worker';
import { accountStatus, accountProbe, signOutAccount } from './account/worker';
// Exact popup only. No message retrieval or production fill adapter.
chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.url !== chrome.runtime.getURL('popup.html')
  )
    return false;
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
      ? gmailLifecycle.connect()
      : message.type === 'gmail-disconnect'
        ? gmailLifecycle.disconnect()
        : message.type === 'gmail-status'
          ? gmailLifecycle.check()
          : message.type === 'account-sign-out'
            ? signOutAccount().then(accountStatus)
            : message.type === 'account-probe'
              ? accountProbe()
              : accountStatus();
  void action.then(respond).catch(() =>
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
