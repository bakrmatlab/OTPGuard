/** A plain, untrusted input notification with no value change is not an edit.
 * Trusted input, InputEvent (including edit intent), beforeinput/change and any
 * value change still invalidate. Never relax field/visibility/binding checks. */
export function unchangedFrameworkInput(
  event: Event,
  field: HTMLInputElement,
  previous: string,
) {
  const InputEvent = field.ownerDocument.defaultView?.InputEvent;
  return (
    event.type === 'input' &&
    !event.isTrusted &&
    !!InputEvent &&
    !(event instanceof InputEvent) &&
    field.value === previous
  );
}
