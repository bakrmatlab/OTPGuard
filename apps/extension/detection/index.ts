/** Page-controlled hints only. These results never authorize retrieval or filling. */
export type Evidence =
  | 'autocomplete'
  | 'otp-label'
  | 'numeric-format'
  | 'split-format'
  | 'email-context'
  | 'authenticator-context'
  | 'sensitive-context'
  | 'context-limit';
export interface FieldGroup {
  id: string;
  fields: readonly HTMLInputElement[];
  evidence: readonly Evidence[];
  flow: 'email' | 'uncertain';
}
export interface DetectionSnapshot {
  groups: readonly FieldGroup[];
  limited: boolean;
}
const MAX_INPUTS = 200;
const MAX_NODES = 2000;
const MAX_TEXT = 4000;
const otp =
  /\b(otp|one[ -]?time|verification|security|confirmation)\b.*\b(code|password)\b|\b(otp|verification code)\b/i;
const email = /\b(email|e-mail|inbox)\b/i;
const authenticator =
  /\b(authenticator|totp|authentication app|backup|recovery)\b/i;
const sensitive =
  /\b(payment|credit card|debit card|cvv|cvc|postal|zip|phone|order)\b/i;

function visible(field: HTMLInputElement): boolean {
  if (
    field.disabled ||
    field.readOnly ||
    field.matches(':disabled') ||
    field.type === 'hidden'
  )
    return false;
  if (field.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  for (let node: Element | null = field; node; node = node.parentElement) {
    const style = field.ownerDocument.defaultView!.getComputedStyle(node);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      Number(style.opacity) === 0
    )
      return false;
  }
  return field.getClientRects().length > 0;
}

function contextText(root: Element): { text: string; limited: boolean } {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  let text = '';
  let count = 0;
  while (count++ < MAX_NODES && text.length < MAX_TEXT) {
    const node = walker.nextNode();
    if (!node) break;
    const parent = node.parentElement;
    if (
      parent?.closest('script, style, template, [hidden], [aria-hidden="true"]')
    )
      continue;
    text += ` ${node.textContent?.slice(0, MAX_TEXT - text.length) ?? ''}`;
  }
  return { text, limited: text.length >= MAX_TEXT || count > MAX_NODES };
}

export function createDetector(document: Document): {
  scan: () => DetectionSnapshot;
} {
  const identities = new WeakMap<HTMLInputElement, number>();
  let nextId = 0;
  return {
    scan() {
      if (document.defaultView?.top !== document.defaultView)
        return { groups: [], limited: false };
      // Bound traversal as well as candidate count; overflow fails closed.
      const walker = document.createTreeWalker(document.documentElement, 1);
      const inputs: HTMLInputElement[] = [];
      let node: Node | null;
      let visited = 0;
      while ((node = walker.nextNode())) {
        if (++visited > MAX_NODES) return { groups: [], limited: true };
        if (node instanceof document.defaultView!.HTMLInputElement) {
          inputs.push(node);
          if (inputs.length > MAX_INPUTS) return { groups: [], limited: true };
        }
      }
      const eligible = inputs.filter(
        (field) =>
          ['text', 'tel', 'number', 'password'].includes(field.type) &&
          visible(field),
      );
      const consumed = new Set<HTMLInputElement>();
      const groups: FieldGroup[] = [];
      for (const field of eligible) {
        if (consumed.has(field)) continue;
        const container =
          field.closest('fieldset, form') ?? field.parentElement!;
        const split = eligible.filter(
          (other) => container.contains(other) && other.maxLength === 1,
        );
        const fields = field.maxLength === 1 ? split : [field];
        if (field.maxLength === 1 && (split.length < 4 || split.length > 8))
          continue;
        const hints = fields
          .map(
            (input) =>
              `${input.name} ${input.id} ${input.getAttribute('aria-label') ?? ''} ${input.placeholder} ${Array.from(
                input.labels ?? [],
              )
                .map((label) => contextText(label).text)
                .join(' ')}`,
          )
          .join(' ')
          .slice(0, MAX_TEXT);
        const contextResult = contextText(container);
        const context = contextResult.text;
        const evidence: Evidence[] = [];
        if (contextResult.limited || hints.length >= MAX_TEXT)
          evidence.push('context-limit');
        if (fields.some((input) => input.autocomplete === 'one-time-code'))
          evidence.push('autocomplete');
        if (otp.test(`${hints} ${context}`)) evidence.push('otp-label');
        if (
          fields.every(
            (input) =>
              input.inputMode === 'numeric' ||
              input.type === 'number' ||
              input.pattern === '[0-9]*',
          )
        )
          evidence.push('numeric-format');
        if (fields.length > 1) evidence.push('split-format');
        if (email.test(context)) evidence.push('email-context');
        if (authenticator.test(`${hints} ${context}`))
          evidence.push('authenticator-context');
        if (sensitive.test(`${hints} ${context}`))
          evidence.push('sensitive-context');
        if (evidence.includes('sensitive-context')) continue;
        if (
          !evidence.includes('autocomplete') &&
          !(
            evidence.includes('otp-label') &&
            evidence.includes('numeric-format')
          )
        )
          continue;
        // A partial split group is not a supported group.
        if (
          fields.length > 1 &&
          inputs.some(
            (input) =>
              container.contains(input) &&
              input.maxLength === 1 &&
              !fields.includes(input),
          )
        )
          continue;
        for (const input of fields) {
          consumed.add(input);
          if (!identities.has(input)) identities.set(input, ++nextId);
        }
        groups.push({
          id: `fields-${fields.map((input) => identities.get(input)).join('-')}`,
          fields,
          evidence,
          flow:
            evidence.includes('email-context') &&
            !evidence.includes('authenticator-context') &&
            !evidence.includes('context-limit')
              ? 'email'
              : 'uncertain',
        });
      }
      return { groups, limited: false };
    },
  };
}

/** Finite observation session; callback includes removal/replacement and expiry. */
export function observeDetection(
  document: Document,
  onChange: (snapshot: DetectionSnapshot) => void,
  options: { durationMs?: number; debounceMs?: number } = {},
): () => void {
  const detector = createDetector(document);
  const view = document.defaultView!;
  let stopped = false;
  let pending: number | undefined;
  let previous = '';
  let scans = 0;
  const publish = () => {
    pending = undefined;
    if (stopped) return;
    if (++scans > 120) {
      stop();
      return;
    }
    const snapshot = detector.scan();
    const key = JSON.stringify([
      snapshot.limited,
      snapshot.groups.map((group) => [group.id, group.flow, group.evidence]),
    ]);
    if (key !== previous) {
      previous = key;
      onChange(snapshot);
    }
  };
  const observer = new view.MutationObserver(() => {
    if (pending === undefined && !stopped)
      pending = view.setTimeout(
        publish,
        Math.max(25, options.debounceMs ?? 100),
      );
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    view.clearTimeout(pending);
    view.clearTimeout(deadline);
    view.removeEventListener('pagehide', stop);
    view.removeEventListener('resize', schedule);
    onChange({ groups: [], limited: false });
  };
  const schedule = () => {
    if (pending === undefined && !stopped)
      pending = view.setTimeout(publish, 100);
  };
  const deadline = view.setTimeout(
    stop,
    Math.min(60_000, Math.max(1, options.durationMs ?? 60_000)),
  );
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  view.addEventListener('pagehide', stop, { once: true });
  view.addEventListener('resize', schedule);
  publish();
  return stop;
}
