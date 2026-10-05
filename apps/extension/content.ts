import { createDetector, codeLengths, type FieldGroup } from './detection';
import { insertCodeRetained } from './insertion';
import { parseWorker, type Binding } from './pipeline/protocol';

const detector = createDetector(document);

let approval: Binding | null = null;
let selected: FieldGroup | undefined;
let stopped = false;
let disconnected = false;
// Chrome can throw before returning a promise after an extension reload. An old
// content script cannot reconnect; revoke its approval and stop its observers.
function send(message: unknown): boolean {
  if (disconnected) return false;
  const disconnect = () => {
    disconnected = true;
    stopped = true;
    approval = null;
    selected = undefined;
    clearInterval(timer);
    clearTimeout(mutationTimer);
    mutations.disconnect();
  };
  try {
    void chrome.runtime.sendMessage(message).catch(disconnect);
    return true;
  } catch {
    disconnect();
    return false;
  }
}
const current = () => {
  const snapshot = detector.scan();
  return (
    !stopped &&
    document.visibilityState === 'visible' &&
    selected &&
    !snapshot.limited &&
    snapshot.groups.length === 1 &&
    snapshot.groups.some(
      (group) =>
        group.id === selected!.id &&
        group.flow === 'email' &&
        group.fields.length === selected!.fields.length &&
        group.fields.every((field, index) => field === selected!.fields[index]),
    ) &&
    selected.fields.every((field) => field.value === '')
  );
};
const cancel = () => {
  stopped = true;
  if (approval) send({ type: 'cancel', requestId: approval.requestId });
  approval = null;
};
addEventListener('pagehide', cancel, { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') cancel();
});
chrome.runtime.onMessage.addListener((value: unknown, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.tab) {
    reply(false);
    return;
  }
  const message = parseWorker(value);
  if (!message) return false;
  if (
    !message ||
    !current() ||
    message.groupId !== selected?.id ||
    !codeLengths(selected!).includes(message.expectedLength) ||
    Date.now() >= message.expiresAt ||
    message.expiresAt > Date.now() + 30_000
  ) {
    reply(false);
    return;
  }
  if (message.type === 'prepare') {
    if (approval) {
      reply(false);
      return;
    }
    approval = {
      requestId: message.requestId,
      groupId: message.groupId,
      expectedLength: message.expectedLength,
      expiresAt: message.expiresAt,
    };
    reply(true);
    return;
  }
  if (
    !approval ||
    JSON.stringify(approval) !==
      JSON.stringify({
        requestId: message.requestId,
        groupId: message.groupId,
        expectedLength: message.expectedLength,
        expiresAt: message.expiresAt,
      })
  ) {
    reply(false);
    return;
  }
  approval = null;
  stopped = true;
  void insertCodeRetained(selected!, message.code, message.expectedLength).then(
    (result) => reply(result.status === 'filled'),
    () => reply(false),
  );
  return true;
});
// Each scan is bounded; a late SPA challenge must not depend on page-load age.
const attempted = new WeakSet<HTMLInputElement>();
function scan(manual = false, fresh = false) {
  if (fresh && approval) cancel();
  if (disconnected || approval || document.visibilityState !== 'visible')
    return false;
  const snapshot = detector.scan();
  if (snapshot.limited || snapshot.groups.length !== 1) return false;
  const group = snapshot.groups[0]!;
  if (
    group.flow !== 'email' ||
    group.fields.some((f) => f.value !== '') ||
    (!manual && !fresh && attempted.has(group.fields[0]!))
  )
    return false;
  const lengths = codeLengths(group);
  if (!lengths.length) return false;
  const length = lengths.length === 1 ? lengths[0]! : 0;
  const replacement = !!selected && selected.id !== group.id;
  const recipient = recipientHint(group);
  selected = group;
  stopped = false;
  attempted.add(group.fields[0]!);
  return send({
    type: 'detect',
    groupId: group.id,
    expectedLength: length,
    allowedLengths: lengths,
    emailFlow: true,
    groupCount: 1,
    manual,
    ...(fresh ? { fresh: true } : {}),
    ...(replacement ? { replacement: true } : {}),
    ...(recipient ? { recipient } : {}),
  });
}
chrome.runtime.onMessage.addListener((value: unknown, sender, reply) => {
  if (
    sender.id === chrome.runtime.id &&
    !sender.tab &&
    value &&
    typeof value === 'object' &&
    Object.keys(value).length === 2 &&
    'type' in value &&
    value.type === 'scan' &&
    'manual' in value &&
    value.manual === true
  ) {
    reply(scan(true));
  }
});
let scans = 0;
const timer = setInterval(() => {
  if (++scans > 120) {
    clearInterval(timer);
    // Observation ends independently of an already admitted request. Prepare
    // and release still rescan the live fields and enforce the worker binding's
    // deadline; ending observation must not invalidate a waiting Fill click.
    return;
  }
  if (approval && !current()) cancel();
  scan();
}, 500);
let mutationTimer: ReturnType<typeof setTimeout> | undefined;
const mutations = new MutationObserver(() => {
  if (mutationTimer !== undefined) return;
  mutationTimer = setTimeout(() => {
    mutationTimer = undefined;
    if (approval && !current()) cancel();
    scan();
  }, 500);
});
mutations.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: [
    'type',
    'autocomplete',
    'inputmode',
    'maxlength',
    'disabled',
    'readonly',
    'hidden',
    'style',
    'class',
  ],
});
addEventListener(
  'pagehide',
  () => {
    clearInterval(timer);
    clearTimeout(mutationTimer);
    mutations.disconnect();
  },
  { once: true },
);
scan();

function recipientHint(group: FieldGroup): string | undefined {
  let container: Element | null = group.fields[0]!.parentElement;
  for (
    let depth = 0;
    container && container !== document.body && depth < 8;
    depth++, container = container.parentElement
  ) {
    const rawText = container.textContent ?? '';
    if (rawText.length > 4000 || /[*•]/.test(rawText)) return undefined;
    // textContent joins adjacent block elements without separators, turning a
    // service heading plus an address into a different recipient. Read the
    // rendered text so block boundaries remain boundaries and inline address
    // fragments retain their displayed spelling.
    const text = container instanceof HTMLElement ? container.innerText : '';
    if (text.length > 4000 || /[*•]/.test(text)) return undefined;
    const addresses = [
      ...text.matchAll(
        /(?<![A-Za-z0-9._%+*•-])[A-Za-z0-9._%+-]{1,128}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,126}[A-Za-z0-9])?/g,
      ),
    ].map((match) => match[0].toLowerCase());
    if (addresses.length)
      return new Set(addresses).size === 1 ? addresses[0] : undefined;
  }
  return undefined;
}
// A trusted local resend gesture establishes a new worker-owned receipt boundary.
// Labels are hints only; they never authorize release or supply a timestamp.
document.addEventListener(
  'click',
  (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const target = event.target.closest('button, a, [role="button"]');
    if (
      !target ||
      !/\b(resend|send (?:a |the )?(?:new )?code again|send again)\b/i.test(
        target.textContent ?? '',
      )
    )
      return;
    const snapshot = detector.scan();
    if (snapshot.groups.length !== 1 || snapshot.groups[0]!.flow !== 'email')
      return;
    const group = snapshot.groups[0]!;
    let root: Element | null = group.fields[0]!.parentElement;
    for (
      let depth = 0;
      root && root !== document.body && depth < 8;
      depth++, root = root.parentElement
    ) {
      if (root.contains(target)) {
        scan(false, true);
        return;
      }
    }
  },
  true,
);

// Early request hints cover the email-to-code transition. They only timestamp a
// trusted local gesture in the worker; no retrieval begins until an OTP is detected.
function noteEmailRequest(event: Event, root: Element) {
  if (!event.isTrusted || root.querySelector('input[type="password"]')) return;
  const fields = root.querySelectorAll<HTMLInputElement>(
    'input[type="email"], input[autocomplete="email"]',
  );
  if (
    fields.length > 5 ||
    !Array.from(fields).some(
      (field) =>
        !field.disabled &&
        !field.readOnly &&
        field.getClientRects().length > 0 &&
        /^[^\s@]+@[^\s@]+$/.test(field.value),
    )
  )
    return;
  send({ type: 'challenge' });
}
document.addEventListener(
  'submit',
  (event) => {
    if (event.target instanceof Element) noteEmailRequest(event, event.target);
  },
  true,
);
document.addEventListener(
  'click',
  (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const target = event.target.closest('button, [role="button"]');
    if (
      !target ||
      !/^(?:continue|next|sign in|log in|send (?:a |the )?(?:verification )?code)$/i.test(
        (target.textContent ?? '').trim(),
      )
    )
      return;
    let root: Element | null = target.parentElement;
    for (
      let depth = 0;
      root && root !== document.body && depth < 8;
      depth++, root = root.parentElement
    ) {
      if (
        root.querySelector('input[type="email"], input[autocomplete="email"]')
      ) {
        noteEmailRequest(event, root);
        return;
      }
    }
  },
  true,
);
