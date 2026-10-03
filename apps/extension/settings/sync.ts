import {
  parseSettings,
  parseReport,
  type Settings,
  type InstallationReport,
} from '../../../packages/shared';
import type { AccountGate, AccountBinding } from '../account/gate';
import type { createLocalSettings } from './local';
export interface SyncTransport {
  readSettings(signal: AbortSignal): Promise<unknown>;
  writeSettings(settings: Settings, signal: AbortSignal): Promise<void>;
  registerInstallation(
    report: InstallationReport,
    signal: AbortSignal,
  ): Promise<void>;
}
export type ConnectSyncTransport = (
  binding: AccountBinding,
  signal: AbortSignal,
) => Promise<SyncTransport>;
/** Inactive production seam: trusted worker adapters own authentication and transport.
 * No mail, account labels, tokens, origins, or mailbox IDs enter these payloads.
 */
export function createSettingsSync(
  local: ReturnType<typeof createLocalSettings>,
  account: AccountGate,
  connect: ConnectSyncTransport | null,
) {
  let enabled = false;
  let generation = 0;
  let remote: Settings | null = null;
  let active: AbortController | null = null;
  let state: 'UNCONFIGURED' | 'OFF' | 'SYNCED' | 'UNAVAILABLE' = connect
    ? 'OFF'
    : 'UNCONFIGURED';
  const reset = () => {
    generation++;
    active?.abort();
    remote = null;
  };
  const unsubscribe = account.subscribe(() => {
    reset();
    state =
      connect && enabled ? 'UNAVAILABLE' : connect ? 'OFF' : 'UNCONFIGURED';
  });
  return {
    status: () => state,
    enable(value: boolean) {
      enabled = value;
      reset();
      state = connect ? (value ? 'UNAVAILABLE' : 'OFF') : 'UNCONFIGURED';
    },
    settings() {
      const value = local.snapshot();
      return {
        autofillEnabled:
          local.available() &&
          value.autofillEnabled &&
          (remote?.autofillEnabled ?? true),
        blockedOrigins: value.blockedOrigins,
      };
    },
    async synchronize(
      providerStatus: InstallationReport['providerStatus'],
      direction: 'pull' | 'push' = 'pull',
    ) {
      if (!connect || !enabled || active) return;
      const before = generation;
      const controller = new AbortController();
      active = controller;
      const timer = setTimeout(() => controller.abort(), 10_000);
      const cancelled = new Promise<never>((_, reject) =>
        controller.signal.addEventListener(
          'abort',
          () => reject(new Error('SYNC_CANCELLED')),
          { once: true },
        ),
      );
      const run = async () => {
        await local.initialized;
        const snapshot = local.snapshot();
        const report = parseReport({
          installationId: snapshot.installationId,
          providerStatus,
        });
        if (!report) throw new Error('INVALID_REPORT');
        const bound = await account.refresh();
        if (
          !bound ||
          !local.available() ||
          before !== generation ||
          controller.signal.aborted
        )
          throw new Error('SYNC_UNAVAILABLE');
        const current = async () => {
          if (
            before !== generation ||
            controller.signal.aborted ||
            !(await account.current(bound)) ||
            before !== generation ||
            controller.signal.aborted
          )
            throw new Error('SYNC_CANCELLED');
        };
        await current();
        const transport = await connect(bound, controller.signal);
        await current();
        await current();
        // Construct closed payloads; never serialize local state wholesale.
        await transport.registerInstallation(report, controller.signal);
        await current();
        const settings = { autofillEnabled: snapshot.autofillEnabled };
        if (direction === 'push') {
          await transport.writeSettings(settings, controller.signal);
          await current();
        }
        const received = parseSettings(
          await transport.readSettings(controller.signal),
        );
        await current();
        if (!received) throw new Error('INVALID_SETTINGS');
        if (local.snapshot().autofillEnabled !== snapshot.autofillEnabled)
          throw new Error('LOCAL_SETTINGS_CHANGED');
        remote = received;
        state = 'SYNCED';
      };
      try {
        await Promise.race([run(), cancelled]);
      } catch {
        if (before === generation) state = 'UNAVAILABLE';
      } finally {
        clearTimeout(timer);
        controller.abort();
        if (active === controller) active = null;
      }
    },
    dispose() {
      reset();
      unsubscribe();
    },
  };
}
