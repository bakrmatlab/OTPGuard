import { accountGate } from '../account/worker';
import { createAuthenticatedMailbox } from './authenticated';
import { gmailLifecycle } from './worker';
const key = 'otpguard.gmail-binding.v1';
export const authenticatedMailbox = createAuthenticatedMailbox(
  accountGate,
  gmailLifecycle,
  {
    async read() {
      await chrome.storage.local.setAccessLevel({
        accessLevel: 'TRUSTED_CONTEXTS',
      });
      return (await chrome.storage.local.get(key))[key];
    },
    async write(value) {
      await chrome.storage.local.setAccessLevel({
        accessLevel: 'TRUSTED_CONTEXTS',
      });
      await chrome.storage.local.set({ [key]: value });
    },
    async remove() {
      await chrome.storage.local.remove(key);
    },
  },
);
