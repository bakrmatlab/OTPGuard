import {
  parseActivity,
  ACTIVITY_LIMIT,
  type ActivityEvent,
} from '../../../packages/shared';
import { cloudActivityPolicyApproved } from '../../../packages/shared/activity-policy';
import type { AccountBinding, AccountGate } from '../account/gate';
export interface ActivityTransport {
  optIn(signal: AbortSignal): Promise<void>;
  append(event: ActivityEvent, signal: AbortSignal): Promise<void>;
  optOutAndDelete(signal: AbortSignal): Promise<void>;
  exportHistory(signal: AbortSignal): Promise<unknown>;
}
export type ConnectActivityTransport = (
  binding: AccountBinding,
  signal: AbortSignal,
) => Promise<ActivityTransport>;
/** Volatile consent binds to one fresh session. No replay queue or local-history upload. */
export function createActivitySync(
  account: AccountGate,
  connect: ConnectActivityTransport | null,
  serviceIds: readonly string[],
  policyApproved = cloudActivityPolicyApproved,
) {
  let consent: AccountBinding | null = null;
  let generation = 0;
  let disposed = false;
  const active = new Set<AbortController>();
  const reset = () => {
    generation++;
    consent = null;
    for (const controller of active) controller.abort();
  };
  const unsubscribe = account.subscribe(reset);
  const same = (a: AccountBinding, b: AccountBinding) =>
    a.userId === b.userId &&
    a.sessionId === b.sessionId &&
    a.generation === b.generation;
  async function run<T>(
    operation: (
      transport: ActivityTransport,
      signal: AbortSignal,
      binding: AccountBinding,
    ) => Promise<T>,
    requireConsent: boolean,
  ): Promise<T | null> {
    if (
      disposed ||
      !connect ||
      (requireConsent && (!policyApproved() || !consent))
    )
      return null;
    const before = generation;
    const expected = consent;
    const controller = new AbortController();
    active.add(controller);
    const timer = setTimeout(() => controller.abort(), 10_000);
    const cancelled = new Promise<never>((_, reject) =>
      controller.signal.addEventListener(
        'abort',
        () => reject(new Error('ACTIVITY_CANCELLED')),
        { once: true },
      ),
    );
    const work = async () => {
      const binding = await account.refresh();
      const current = async () => {
        if (
          !binding ||
          controller.signal.aborted ||
          generation !== before ||
          (requireConsent &&
            (!consent ||
              !expected ||
              !same(binding, expected) ||
              !policyApproved())) ||
          !(await account.current(binding)) ||
          generation !== before ||
          controller.signal.aborted
        )
          throw new Error('ACTIVITY_CANCELLED');
      };
      await current();
      const transport = await connect(binding!, controller.signal);
      await current();
      const result = await operation(transport, controller.signal, binding!);
      await current();
      return result;
    };
    try {
      return await Promise.race([work(), cancelled]);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      controller.abort();
      active.delete(controller);
    }
  }
  return {
    enabled: () => !!consent,
    async enable() {
      reset();
      const before = generation;
      if (disposed || !policyApproved()) return false;
      const bound = await run(async (transport, signal, binding) => {
        await transport.optIn(signal);
        return binding;
      }, false);
      if (
        !bound ||
        !(await account.current(bound)) ||
        generation !== before ||
        !policyApproved()
      )
        return false;
      consent = bound;
      return true;
    },
    async upload(input: unknown, source: AccountBinding) {
      const event = parseActivity(input, serviceIds);
      if (!event || !consent || !same(source, consent) || active.size >= 4)
        return false;
      return (
        (await run(async (transport, signal) => {
          await transport.append(event, signal);
          return true;
        }, true)) === true
      );
    },
    async disableAndDelete() {
      reset();
      return (
        (await run(async (transport, signal) => {
          await transport.optOutAndDelete(signal);
          return true;
        }, false)) === true
      );
    },
    async export() {
      const received = await run(
        (transport, signal) => transport.exportHistory(signal),
        false,
      );
      if (!Array.isArray(received) || received.length > ACTIVITY_LIMIT)
        return null;
      const events = received.map((event) => parseActivity(event, serviceIds));
      return events.some((event) => !event)
        ? null
        : JSON.stringify({ version: 1, events });
    },
    dispose() {
      disposed = true;
      reset();
      unsubscribe();
    },
  };
}
