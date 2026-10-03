import { parseActivity } from '../../../packages/shared';
import type { Adapter } from '../pipeline/coordinator';
import type { createLocalHistory } from './local';
import type { createActivitySync } from './sync';
/** Construct six fields explicitly. Unknown service becomes null; no context serialized. */
export function createActivityRecorder(
  history: ReturnType<typeof createLocalHistory>,
  installationId: () => string,
  serviceIds: readonly string[],
  cloud: ReturnType<typeof createActivitySync> | null = null,
): NonNullable<Adapter['activity']> {
  return async (outcome, binding) => {
    const event = parseActivity(
      {
        serviceId: serviceIds.includes(outcome.serviceId)
          ? outcome.serviceId
          : null,
        action: 'FILL',
        result: outcome.result,
        reason: outcome.reason,
        time: outcome.time,
        installationId: installationId(),
      },
      serviceIds,
    );
    if (!event) return;
    // Neither local storage nor cloud delivery is a prerequisite for the other or for fill.
    void history.append(event).catch(() => {});
    if (binding) void cloud?.upload(event, binding).catch(() => {});
  };
}
