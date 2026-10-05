/** Closed, minimal runtime protocol. No page-provided account, origin or evidence. */
export type DetectionMessage = {
  type: 'detect';
  groupId: string;
  expectedLength: number;
  emailFlow: boolean;
  groupCount: number;
  manual?: boolean;
};
export type ClientMessage =
  | DetectionMessage
  | { type: 'cancel'; requestId: string };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value);
export function parseClient(value: unknown): ClientMessage | null {
  if (!record(value)) return null;
  const keys = Object.keys(value).sort().join(',');
  if (
    value.type === 'cancel' &&
    keys === 'requestId,type' &&
    identifier(value.requestId)
  )
    return { type: 'cancel', requestId: value.requestId };
  if (
    value.type !== 'detect' ||
    ![
      'emailFlow,expectedLength,groupCount,groupId,type',
      'emailFlow,expectedLength,groupCount,groupId,manual,type',
    ].includes(keys) ||
    (value.manual !== undefined && typeof value.manual !== 'boolean') ||
    !identifier(value.groupId) ||
    typeof value.emailFlow !== 'boolean' ||
    !Number.isInteger(value.expectedLength) ||
    Number(value.expectedLength) < 4 ||
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
    /^[0-9]{4,8}$/.test(value.code) &&
    value.code.length === value.expectedLength
  )
    return value as unknown as WorkerMessage;
  return null;
}
