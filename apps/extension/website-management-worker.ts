import { configuredAccount } from './account/config';
import { accountGate } from './account/worker';
import { authenticatedMailbox } from './gmail/authenticated-worker';
import { localSettings, settingsStatus } from './settings/worker';
import { historyAction, localHistory } from './activity/worker';
import { createWebsiteManagement, websiteSender } from './website-management';
const origin = configuredAccount()?.webOrigin;
if (origin) {
  const handle = createWebsiteManagement({
    origin,
    gate: accountGate,
    async documentCurrent(sender) {
      const frame = await chrome.webNavigation.getFrame({
        tabId: sender.tab!.id!,
        frameId: 0,
      });
      return (
        !!frame &&
        frame.documentId === sender.documentId &&
        websiteSender({ ...sender, url: frame.url }, origin)
      );
    },
    async run(action, current) {
      let exportJson: string | undefined;
      // No awaits between final authority check and dispatch of a requested mutation.
      if (!(await current())) return { state: 'REFUSED' };
      if (action.type === 'settings-autofill')
        await localSettings.setAutofill(action.enabled, current);
      if (action.type === 'settings-block')
        await localSettings.setBlock(action.origin, action.blocked, current);
      if (action.type === 'gmail-connect')
        await authenticatedMailbox.connect(current);
      if (action.type === 'gmail-disconnect')
        await authenticatedMailbox.disconnect();
      if (action.type === 'open-options')
        await chrome.runtime.openOptionsPage();
      if (action.type === 'history-delete') await localHistory.clear(current);
      if (action.type === 'history-export') {
        const result = await historyAction({ type: 'history-export' });
        if ('json' in result) exportJson = result.json;
      }
      if (!(await current())) return { state: 'REFUSED' };
      const settings = await settingsStatus();
      const mailbox = await authenticatedMailbox.check();
      const history = await historyAction({ type: 'history-status' }).catch(
        () => ({ state: 'UNAVAILABLE' }),
      );
      const siteAccess = await chrome.permissions.contains({
        origins: ['https://*/*'],
      });
      return {
        state: 'CONNECTED',
        snapshot: {
          settings: {
            state: settings.state,
            autofillEnabled: settings.autofillEnabled,
            blockedOrigins: settings.blockedOrigins,
          },
          mailbox: {
            state: mailbox.state,
            ...(mailbox.mailbox ? { mailbox: mailbox.mailbox } : {}),
          },
          history: {
            state: history.state,
            ...('count' in history
              ? {
                  count: history.count,
                  ...('lastAction' in history && history.lastAction
                    ? { lastAction: history.lastAction }
                    : {}),
                }
              : {}),
          },
          siteAccess,
        },
        ...(exportJson === undefined ? {} : { exportJson }),
      };
    },
  });
  chrome.runtime.onMessageExternal.addListener(
    (message: unknown, sender, respond) => {
      void handle(message, sender).then(respond, () =>
        respond({ state: 'UNAVAILABLE' }),
      );
      return true;
    },
  );
}
