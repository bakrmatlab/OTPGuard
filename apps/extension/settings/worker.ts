import { createLocalSettings, canonicalBlock } from './local';
const key = 'otpguard.settings.v1';
export const localSettings = createLocalSettings({
  async read() {
    await chrome.storage.local.setAccessLevel({
      accessLevel: 'TRUSTED_CONTEXTS',
    });
    return (await chrome.storage.local.get(key))[key];
  },
  async write(value) {
    await chrome.storage.local.set({ [key]: value });
  },
});
export async function settingsStatus() {
  await localSettings.initialized;
  const value = localSettings.snapshot();
  return {
    state: localSettings.available() ? 'LOCAL' : 'UNAVAILABLE',
    autofillEnabled: value.autofillEnabled,
    blockedOrigins: value.blockedOrigins,
    sync: 'UNCONFIGURED',
  };
}
export function parseSettingsAction(
  value: unknown,
):
  | { type: 'settings-status' }
  | { type: 'settings-autofill'; enabled: boolean }
  | { type: 'settings-block'; origin: string; blocked: boolean }
  | null {
  if (!value || typeof value !== 'object' || !('type' in value)) return null;
  const keys = Object.keys(value);
  if (value.type === 'settings-status' && keys.length === 1)
    return { type: value.type };
  if (
    value.type === 'settings-autofill' &&
    keys.length === 2 &&
    'enabled' in value &&
    typeof value.enabled === 'boolean'
  )
    return { type: value.type, enabled: value.enabled };
  if (
    value.type === 'settings-block' &&
    keys.length === 3 &&
    'origin' in value &&
    typeof value.origin === 'string' &&
    canonicalBlock(value.origin) &&
    'blocked' in value &&
    typeof value.blocked === 'boolean'
  )
    return { type: value.type, origin: value.origin, blocked: value.blocked };
  return null;
}
export async function settingsAction(
  action: NonNullable<ReturnType<typeof parseSettingsAction>>,
) {
  if (action.type === 'settings-autofill')
    await localSettings.setAutofill(action.enabled);
  if (action.type === 'settings-block')
    await localSettings.setBlock(action.origin, action.blocked);
  return settingsStatus();
}
