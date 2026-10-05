import { createConnectedCoordinator } from '../account/connected';
import type { AccountGate } from '../account/gate';
import type { Adapter } from '../pipeline/coordinator';
import type { createGmailLifecycle } from './lifecycle';
/** Future production retrieval must pass both independent identity boundaries. */
export function createMailboxCoordinator(
  adapter: Adapter,
  account: AccountGate,
  mailbox: ReturnType<typeof createGmailLifecycle>,
  ensureMailbox = () => mailbox.check(),
) {
  let generation = 0;
  const coordinator = createConnectedCoordinator(
    {
      ...adapter,
      async context(sender, signal) {
        const before = generation;
        adapter.progress?.('mailbox');
        const status = await ensureMailbox();
        if (signal?.aborted) return null;
        if (status.state !== 'CONNECTED') {
          adapter.contextFailure?.('mailbox');
          return null;
        }
        const context = await adapter.context(sender, signal);
        return before === generation && context?.mailboxId === status.mailbox
          ? context
          : null;
      },
      async retrieve(context, signal) {
        const status = await mailbox.check();
        if (
          signal.aborted ||
          status.state !== 'CONNECTED' ||
          status.mailbox !== context.mailboxId
        )
          return null;
        return adapter.retrieve(context, signal);
      },
      async current(context) {
        const before = generation;
        const status = await mailbox.check();
        return (
          before === generation &&
          status.state === 'CONNECTED' &&
          status.mailbox === context.mailboxId &&
          (await adapter.current(context)) &&
          before === generation
        );
      },
    },
    account,
  );
  const unsubscribe = mailbox.subscribe(() => {
    generation++;
    coordinator.cancelAll('mailbox-changed');
  });
  return {
    ...coordinator,
    dispose() {
      unsubscribe();
      coordinator.dispose();
    },
  };
}
