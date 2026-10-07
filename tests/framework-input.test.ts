import { expect, it, vi, afterEach } from 'vitest';
const state = vi.hoisted(() => ({
  field: null as unknown as HTMLInputElement,
}));
vi.mock('../apps/extension/detection', () => ({
  createDetector: () => ({
    scan: () => ({ limited: false, groups: [{ fields: [state.field] }] }),
  }),
  codeLengths: () => [6],
}));
import { insertCodeRetained } from '../apps/extension/insertion';
afterEach(() => vi.useRealTimers());
it.each([
  'unchanged',
  'changed',
  'restored',
  'beforeinput',
  'input-event',
  'trusted',
] as const)('checks framework input notification: %s', async (kind) => {
  vi.useFakeTimers();
  const listeners = new Map<string, Set<(event: Event) => void>>();
  class Input extends EventTarget {
    value = '';
    type = 'text';
    pattern = '';
    maxLength = 6;
    minLength = 0;
    isConnected = true;
    ownerDocument!: Document;
  }
  const field = new Input();
  class InputEventFixture extends Event {
    constructor(type: string, init: EventInit) {
      super(type, init);
    }
  }
  const view = {
    HTMLInputElement: Input,
    InputEvent: InputEventFixture,
    Event,
    top: null as unknown,
    setTimeout,
  };
  view.top = view;
  const document = {
    defaultView: view,
    visibilityState: 'visible',
    addEventListener(type: string, listener: (event: Event) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      listeners.get(type)?.delete(listener);
    },
  };
  // The production setter must be on the prototype, as in a native input.
  let value = '';
  Object.defineProperty(Input.prototype, 'value', {
    get: () => value,
    set: (next: string) => {
      value = next;
    },
    configurable: true,
  });
  delete (field as Partial<Input>).value;
  field.ownerDocument = document as unknown as Document;
  state.field = field as unknown as HTMLInputElement;
  const result = insertCodeRetained(
    { id: 'synthetic', fields: [state.field], evidence: [], flow: 'email' },
    '042681',
    6,
  );
  const notification =
    kind === 'input-event'
      ? new InputEventFixture('input', {})
      : new Event(kind === 'beforeinput' ? 'beforeinput' : 'input');
  if (kind === 'trusted')
    Object.defineProperty(notification, 'isTrusted', { value: true });
  Object.defineProperty(notification, 'target', { value: field });
  setTimeout(() => {
    if (kind === 'changed' || kind === 'restored') field.value = '999999';
    for (const listener of listeners.get(notification.type) ?? [])
      listener(notification);
    if (kind === 'restored') field.value = '042681';
  }, 50);
  await vi.advanceTimersByTimeAsync(600);
  expect(await result).toEqual(
    kind === 'unchanged'
      ? { status: 'filled' }
      : { status: 'rejected', reason: 'page-interference' },
  );
});
