import {
  createDetector,
  type FieldGroup,
} from '../../apps/extension/detection';
import { insertCode } from '../../apps/extension/insertion';
import {
  parseWorker,
  type Binding,
} from '../../apps/extension/pipeline/protocol';

const detector = createDetector(document);
const initial = detector.scan();
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
// One finite request per document. Restart never silently resends a live request.
if (
  !initial.limited &&
  initial.groups.length > 0 &&
  document.visibilityState === 'visible'
) {
  selected = initial.groups[0];
  if (selected?.flow === 'email')
    void chrome.runtime
      .sendMessage({
        type: 'detect',
        groupId: selected.id,
        expectedLength:
          selected.fields.length > 1
            ? selected.fields.length
            : selected.fields[0]!.maxLength,
        emailFlow: true,
        groupCount: initial.groups.length,
      })
      .catch(() => {});
}
setTimeout(cancel, 60_000);
