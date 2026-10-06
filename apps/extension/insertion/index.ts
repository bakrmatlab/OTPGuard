import { createDetector, codeLengths, type FieldGroup } from '../detection';

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
  if (!/^[A-Za-z0-9]{4,8}$/.test(code)) return reject('invalid-code');
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
  if (!codeLengths(group).includes(code.length)) return reject('length');
  if (fields.some((field) => field.value !== '')) return reject('user-value');
  if (
    fields.some(
      (field) => !['text', 'tel', 'password', 'number'].includes(field.type),
    )
  )
    return reject('unsupported');
  if (
    fields.length > 1
      ? fields.length !== expectedLength
      : (fields[0]!.maxLength >= 0 && fields[0]!.maxLength < expectedLength) ||
        fields[0]!.minLength > expectedLength
  )
    return reject('length');
  const formatCompatible = () =>
    fields.every((field) => {
      if (field.type === 'number' && /[A-Za-z]/.test(code)) return false;
      if (!field.pattern) return true;
      if (field.pattern.length > 256) return false;
      try {
        const value = fields.length === 1 ? code : code[fields.indexOf(field)]!;
        return new RegExp(`^(?:${field.pattern})$`, 'v').test(value);
      } catch {
        return false;
      }
    });
  if (!formatCompatible()) return reject('unsupported');
  const compatible = () =>
    codeLengths(group).includes(code.length) &&
    formatCompatible() &&
    fields.every(
      (field) =>
        ['text', 'tel', 'password', 'number'].includes(field.type) &&
        (fields.length > 1
          ? field.maxLength === 1
          : (field.maxLength === -1 || field.maxLength >= expectedLength) &&
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
    const accepted = field.dispatchEvent(
      new view.InputEvent('beforeinput', {
        bubbles: true,
        composed: true,
        cancelable: true,
        inputType: 'insertReplacementText',
        data: values[index]!,
      }),
    );
    if (
      !accepted ||
      !current() ||
      !compatible() ||
      fields.some(
        (member, position) =>
          member.value !== (position < index ? values[position] : ''),
      )
    )
      return reject('page-interference');
    setter.call(field, values[index]);
    field.dispatchEvent(
      new view.InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertReplacementText',
        data: values[index]!,
      }),
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

/** Acknowledge retained values after queued framework/timer updates, not merely
 * the synchronous setter. Never retry, roll back, or overwrite a page/user change. */
export async function insertCodeRetained(
  group: FieldGroup,
  code: string,
  expectedLength: number,
): Promise<FillResult> {
  const result = insertCode(group, code, expectedLength);
  if (result.status !== 'filled') return result;
  const document = group.fields[0]!.ownerDocument;
  const view = document.defaultView!;
  const values = group.fields.length === 1 ? [code] : [...code];
  let interfered = false;
  const edit = (event: Event) => {
    if (group.fields.includes(event.target as HTMLInputElement))
      interfered = true;
  };
  const retained = () => {
    const snapshot = createDetector(document).scan();
    return (
      document.visibilityState === 'visible' &&
      !snapshot.limited &&
      snapshot.groups.some(
        (candidate) =>
          candidate.fields.length === group.fields.length &&
          candidate.fields.every(
            (field, index) => field === group.fields[index],
          ),
      ) &&
      codeLengths(group).includes(code.length) &&
      group.fields.every((field, index) => {
        if (!field.isConnected || field.value !== values[index]) return false;
        if (field.type === 'number' && /[A-Za-z]/.test(code)) return false;
        if (!field.pattern) return true;
        if (field.pattern.length > 256) return false;
        try {
          return new RegExp(`^(?:${field.pattern})$`, 'v').test(values[index]!);
        } catch {
          return false;
        }
      })
    );
  };
  // A bounded observation window, not proof of server acceptance or permanence.
  // Observe edits even if a framework restores the expected value before a poll.
  document.addEventListener('input', edit, true);
  document.addEventListener('beforeinput', edit, true);
  document.addEventListener('change', edit, true);
  try {
    for (let elapsed = 0; elapsed < 500; elapsed += 25) {
      await new Promise<void>((resolve) => view.setTimeout(resolve, 25));
      if (interfered || !retained())
        return { status: 'rejected', reason: 'page-interference' };
    }
    return { status: 'filled' };
  } finally {
    document.removeEventListener('input', edit, true);
    document.removeEventListener('beforeinput', edit, true);
    document.removeEventListener('change', edit, true);
  }
}
