import { createDetector, type FieldGroup } from './detection';
import { insertCode } from './insertion';
import { parseWorker, type Binding } from './pipeline/protocol';

const detector = createDetector(document);

let approval: Binding | null = null;
let selected: FieldGroup | undefined;
let stopped = false;
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
  if (approval)
    void chrome.runtime
      .sendMessage({ type: 'cancel', requestId: approval.requestId })
      .catch(() => {});
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
  reply(
    insertCode(selected!, message.code, message.expectedLength).status ===
      'filled',
  );
});
// Shared bounded observer supports a code field appearing after an SPA transition.
const attempted = new WeakSet<HTMLInputElement>();
function scan(manual = false) {
  if (approval || document.visibilityState !== 'visible') return false;
  const snapshot = detector.scan();
  if (snapshot.limited || snapshot.groups.length !== 1) return false;
  const group = snapshot.groups[0]!;
  if (
    group.flow !== 'email' ||
    group.fields.some((f) => f.value !== '') ||
    (!manual && attempted.has(group.fields[0]!))
  )
    return false;
  const length =
    group.fields.length > 1 ? group.fields.length : group.fields[0]!.maxLength;
  if (length < 4 || length > 8) return false;
  selected = group;
  stopped = false;
  attempted.add(group.fields[0]!);
  void chrome.runtime
    .sendMessage({
      type: 'detect',
      groupId: group.id,
      expectedLength: length,
      emailFlow: true,
      groupCount: 1,
      manual,
    })
    .catch(() => {});
  return true;
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
addEventListener('pagehide', () => clearInterval(timer), { once: true });
scan();
