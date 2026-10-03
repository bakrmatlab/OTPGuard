import { gmailLifecycle } from './gmail/worker';
import { accountStatus, signOutAccount } from './account/worker';
// Exact popup only. No message retrieval or production fill adapter.
chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.url !== chrome.runtime.getURL('popup.html')
  )
    return false;
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
      'account-sign-out',
      'gmail-status',
      'gmail-connect',
      'gmail-disconnect',
    ].includes(message.type)
  )
    return false;
  const action =
    message.type === 'gmail-connect'
      ? gmailLifecycle.connect()
      : message.type === 'gmail-disconnect'
        ? gmailLifecycle.disconnect()
        : message.type === 'gmail-status'
          ? gmailLifecycle.check()
          : message.type === 'account-sign-out'
            ? signOutAccount().then(accountStatus)
            : accountStatus();
  void action.then(respond).catch(() =>
    respond({
      state:
        message.type === 'account-sign-out'
          ? 'SIGN_OUT_FAILED'
          : 'SIGN_IN_REQUIRED',
    }),
  );
  return true;
});
