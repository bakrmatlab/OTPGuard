/** Activity is sensitive even without mail. These are maximum retention windows. */
export const LOCAL_RETENTION_MS = 7 * 24 * 60 * 60_000;
export const CLOUD_RETENTION_MS = 30 * 24 * 60 * 60_000;
export const ACTIVITY_LIMIT = 500;
export const ACTIVITY_RESULTS = [
  'FILLED',
  'REFUSED',
  'CANCELLED',
  'ERROR',
] as const;
export const ACTIVITY_REASONS = [
  'none',
  'local-block',
  'unsupported-service',
  'destination',
  'request',
  'ambiguity',
  'sender',
  'message-binding',
  'freshness',
  'code',
  'delivery',
] as const;
export interface ActivityEvent {
  serviceId: string | null;
  action: 'FILL';
  result: (typeof ACTIVITY_RESULTS)[number];
  reason: (typeof ACTIVITY_REASONS)[number];
  time: number;
  installationId: string;
}
/** Unknown service is null, never a page-supplied name or hostname. */
export function parseActivity(
  value: unknown,
  serviceIds: readonly string[],
): ActivityEvent | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).length !== 6 ||
    ![
      'serviceId',
      'action',
      'result',
      'reason',
      'time',
      'installationId',
    ].every((key) => Object.hasOwn(value, key)) ||
    !('serviceId' in value) ||
    !(
      value.serviceId === null ||
      (typeof value.serviceId === 'string' &&
        serviceIds.includes(value.serviceId))
    ) ||
    !('action' in value) ||
    value.action !== 'FILL' ||
    !('result' in value) ||
    typeof value.result !== 'string' ||
    !(ACTIVITY_RESULTS as readonly string[]).includes(value.result) ||
    !('reason' in value) ||
    typeof value.reason !== 'string' ||
    !(ACTIVITY_REASONS as readonly string[]).includes(value.reason) ||
    !('time' in value) ||
    typeof value.time !== 'number' ||
    !Number.isSafeInteger(value.time) ||
    value.time < 0 ||
    !('installationId' in value) ||
    typeof value.installationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value.installationId,
    )
  )
    return null;
  if ((value.result === 'FILLED') !== (value.reason === 'none')) return null;
  return {
    serviceId: value.serviceId,
    action: 'FILL',
    result: value.result as ActivityEvent['result'],
    reason: value.reason as ActivityEvent['reason'],
    time: value.time,
    installationId: value.installationId,
  };
}
