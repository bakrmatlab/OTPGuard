import { createLocalHistory } from './local';
const key = 'otpguard.activity.v1';
export const localHistory = createLocalHistory(
  {
    async read() {
      await chrome.storage.local.setAccessLevel({
        accessLevel: 'TRUSTED_CONTEXTS',
      });
      return (await chrome.storage.local.get(key))[key];
    },
    async write(value) {
      await chrome.storage.local.set({ [key]: value });
    },
  },
  // History from builds with the Canva pilot can hold 'canva' events. Keep the id
  // valid so those stored records still parse instead of making history unavailable.
  ['canva'],
);
export function parseHistoryAction(
  value: unknown,
): { type: 'history-status' | 'history-export' | 'history-delete' } | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, 'type') ||
    !('type' in value) ||
    !['history-status', 'history-export', 'history-delete'].includes(
      value.type as string,
    )
  )
    return null;
  return {
    type: value.type as 'history-status' | 'history-export' | 'history-delete',
  };
}
export async function historyAction(
  action: NonNullable<ReturnType<typeof parseHistoryAction>>,
) {
  if (action.type === 'history-delete') await localHistory.clear();
  if (action.type === 'history-export')
    return {
      state: 'LOCAL',
      cloud: 'POLICY_UNRESOLVED',
      json: await localHistory.export(),
    };
  const events = await localHistory.list();
  const latest = events.reduce<(typeof events)[number] | undefined>(
    (last, event) => (!last || event.time >= last.time ? event : last),
    undefined,
  );
  return {
    state: 'LOCAL',
    cloud: 'POLICY_UNRESOLVED',
    count: events.length,
    ...(latest
      ? {
          lastAction: {
            result: latest.result,
            reason: latest.reason,
            time: latest.time,
          },
        }
      : {}),
  };
}
// Opportunistic physical expiry on worker startup; no worker keepalive.
void localHistory.list().catch(() => {});
