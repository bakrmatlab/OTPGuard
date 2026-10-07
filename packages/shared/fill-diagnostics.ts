/** Closed, code-free replies from the owned content script to its worker. */
export const FILL_REFUSALS = [
  'field-not-ready',
  'field-binding-changed',
  'field-length-changed',
  'input-invalid-code',
  'input-length',
  'input-stale-group',
  'input-user-value',
  'input-unsupported',
  'input-page-interference',
] as const;
export type FillRefusal = (typeof FILL_REFUSALS)[number];
export function fillRefusal(value: unknown): FillRefusal | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).length !== 2 ||
    !('status' in value) ||
    value.status !== 'refused' ||
    !('reason' in value) ||
    typeof value.reason !== 'string' ||
    !(FILL_REFUSALS as readonly string[]).includes(value.reason)
  )
    return null;
  return value.reason as FillRefusal;
}
