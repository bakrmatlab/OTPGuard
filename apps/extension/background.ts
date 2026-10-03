import { accountStatus, signOutAccount } from './account/worker';
// Account UI only. No content listener, Gmail retrieval, or production fill adapter.
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
  if (message.type !== 'account-status' && message.type !== 'account-sign-out')
    return false;
  const action =
    message.type === 'account-sign-out'
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
