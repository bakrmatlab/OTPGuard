import { parseActivity } from '../../../packages/shared';
import type { Adapter } from '../pipeline/coordinator';
import type { createLocalHistory } from './local';
/** Construct six fields explicitly. Unknown service becomes null; no context serialized. */
export function createActivityRecorder(
  history: ReturnType<typeof createLocalHistory>,
  installationId: () => string,
  serviceIds: readonly string[],
): NonNullable<Adapter['activity']> {
  return async (outcome) => {
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
    // Local storage is never a prerequisite for fill.
    void history.append(event).catch(() => {});
  };
}
