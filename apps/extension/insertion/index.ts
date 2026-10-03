import { createDetector, type FieldGroup } from '../detection';

export type FillResult =
  | { status: 'filled' }
  | {
      status: 'rejected';
      reason:
        | 'invalid-code'
        | 'length'
        | 'stale-group'
        | 'user-value'
        | 'unsupported'
        | 'page-interference';
    };

/** DOM mechanism only: callers must authorize release before passing a code.
 * No Chrome registration, retrieval, trust decision, or submission lives here.
 */
export function insertCode(
  group: FieldGroup,
  code: string,
  expectedLength: number,
): FillResult {
  const reject = (
    reason: Extract<FillResult, { status: 'rejected' }>['reason'],
  ): FillResult => ({ status: 'rejected', reason });
  if (!/^[0-9]{4,8}$/.test(code)) return reject('invalid-code');
  if (!Number.isInteger(expectedLength) || code.length !== expectedLength)
    return reject('length');
  const fields = [...group.fields];
  const document = fields[0]?.ownerDocument;
  const view = document?.defaultView;
  if (!document || !view || view.top !== view) return reject('unsupported');
  const current = () =>
    createDetector(document)
      .scan()
      .groups.some(
        (candidate) =>
          candidate.fields.length === fields.length &&
          candidate.fields.every((field, index) => field === fields[index]),
      );
  if (!current()) return reject('stale-group');
  if (fields.some((field) => field.value !== '')) return reject('user-value');
  if (fields.some((field) => !['text', 'tel', 'password'].includes(field.type)))
    return reject('unsupported');
  if (
    fields.length > 1
      ? fields.length !== expectedLength
      : (fields[0]!.maxLength >= 0 &&
          fields[0]!.maxLength !== expectedLength) ||
        fields[0]!.minLength > expectedLength
  )
    return reject('length');
  const compatible = () =>
    fields.every(
      (field) =>
        ['text', 'tel', 'password'].includes(field.type) &&
        (fields.length > 1
          ? field.maxLength === 1
          : (field.maxLength === -1 || field.maxLength === expectedLength) &&
            field.minLength <= expectedLength),
    );
  const setter = Object.getOwnPropertyDescriptor(
    view.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) return reject('unsupported');
  const values = fields.length === 1 ? [code] : [...code];
  for (let index = 0; index < fields.length; index++) {
    // Page event handlers may replace/disable fields or type into a later member.
    // Stop without rollback: clearing values could erase a page/user change.
    if (
      !current() ||
      !compatible() ||
      fields.some(
        (field, position) =>
          field.value !== (position < index ? values[position] : ''),
      )
    )
      return reject('page-interference');
    const field = fields[index]!;
    setter.call(field, values[index]);
    field.dispatchEvent(
      new view.Event('input', { bubbles: true, composed: true }),
    );
    if (field.value !== values[index] || !current() || !compatible())
      return reject('page-interference');
    field.dispatchEvent(new view.Event('change', { bubbles: true }));
  }
  if (
    !current() ||
    !compatible() ||
    fields.some((field, index) => field.value !== values[index])
  )
    return reject('page-interference');
  return { status: 'filled' };
}
