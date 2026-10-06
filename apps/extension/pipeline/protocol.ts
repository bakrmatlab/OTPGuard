import { parseMailboxAddress } from '../../../packages/otp/addresses';
/** Closed, minimal runtime protocol. No page-provided account, origin or evidence. */
export type DetectionMessage = {
  type: 'detect';
  groupId: string;
  expectedLength: number;
  emailFlow: boolean;
  groupCount: number;
  manual?: boolean;
  /** A new challenge/resend observed locally, never a page-provided timestamp. */
  fresh?: boolean;
  replacement?: boolean;
  recipient?: string;
  allowedLengths?: readonly number[];
};
export type ClientMessage =
  | DetectionMessage
  | { type: 'challenge' }
  | { type: 'cancel'; requestId: string };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value);
export function parseClient(value: unknown): ClientMessage | null {
  if (!record(value)) return null;
  const keys = Object.keys(value).sort().join(',');
  if (value.type === 'challenge' && keys === 'type')
    return { type: 'challenge' };
  if (
    value.type === 'cancel' &&
    keys === 'requestId,type' &&
    identifier(value.requestId)
  )
    return { type: 'cancel', requestId: value.requestId };
  if (
    value.type !== 'detect' ||
    Object.keys(value).some(
      (key) =>
        ![
          'type',
          'groupId',
          'expectedLength',
          'emailFlow',
          'groupCount',
          'manual',
          'fresh',
          'replacement',
          'recipient',
          'allowedLengths',
        ].includes(key),
    ) ||
    !['groupId', 'expectedLength', 'emailFlow', 'groupCount'].every(
      (key) => key in value,
    ) ||
    (value.manual !== undefined && typeof value.manual !== 'boolean') ||
    (value.fresh !== undefined && typeof value.fresh !== 'boolean') ||
    (value.replacement !== undefined &&
      typeof value.replacement !== 'boolean') ||
    (value.recipient !== undefined &&
      (typeof value.recipient !== 'string' ||
        !parseMailboxAddress(value.recipient))) ||
    (value.allowedLengths !== undefined &&
      (!Array.isArray(value.allowedLengths) ||
        value.allowedLengths.length < 1 ||
        value.allowedLengths.length > 5 ||
        new Set(value.allowedLengths).size !== value.allowedLengths.length ||
        value.allowedLengths.some(
          (length) => !Number.isInteger(length) || length < 4 || length > 8,
        ))) ||
    !identifier(value.groupId) ||
    typeof value.emailFlow !== 'boolean' ||
    !Number.isInteger(value.expectedLength) ||
    (Number(value.expectedLength) !== 0 && Number(value.expectedLength) < 4) ||
    Number(value.expectedLength) > 8 ||
    !Number.isInteger(value.groupCount) ||
    Number(value.groupCount) < 1 ||
    Number(value.groupCount) > 200
  )
    return null;
  return value as DetectionMessage;
}
export interface Binding {
  requestId: string;
  groupId: string;
  expectedLength: number;
  expiresAt: number;
}
export type WorkerMessage =
  | (Binding & { type: 'prepare' })
  | (Binding & { type: 'release'; code: string });
export function parseWorker(value: unknown): WorkerMessage | null {
  if (
    !record(value) ||
    !identifier(value.requestId) ||
    !identifier(value.groupId) ||
    !Number.isInteger(value.expectedLength) ||
    Number(value.expectedLength) < 4 ||
    Number(value.expectedLength) > 8 ||
    !Number.isSafeInteger(value.expiresAt) ||
    Number(value.expiresAt) < 0
  )
    return null;
  const keys = Object.keys(value).sort().join(',');
  if (
    value.type === 'prepare' &&
    keys === 'expectedLength,expiresAt,groupId,requestId,type'
  )
    return value as unknown as WorkerMessage;
  if (
    value.type === 'release' &&
    keys === 'code,expectedLength,expiresAt,groupId,requestId,type' &&
    typeof value.code === 'string' &&
    /^[A-Za-z0-9]{4,8}$/.test(value.code) &&
    value.code.length === value.expectedLength
  )
    return value as unknown as WorkerMessage;
  return null;
}
