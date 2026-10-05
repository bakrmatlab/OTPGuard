import type { AccountBinding, AccountGate } from '../account/gate';
import type { createGmailLifecycle, MailboxStatus } from './lifecycle';

/** Bind local mailbox consent to the selected Clerk session, without equating emails. */
export function createAuthenticatedMailbox(
  account: AccountGate,
  mailbox: ReturnType<typeof createGmailLifecycle>,
) {
  let owner: Pick<AccountBinding, 'userId' | 'sessionId'> | undefined;
  let pending = false;
  account.subscribe(() => {
    if (owner || pending) mailbox.invalidate();
  });
  const run = async (connect: boolean): Promise<MailboxStatus> => {
    if (mailbox.snapshot().state === 'UNCONFIGURED') return mailbox.snapshot();
    const bound = await account.refresh(true);
    if (!bound) return { state: 'SIGN_IN_REQUIRED' };
    if (
      owner &&
      (owner.userId !== bound.userId || owner.sessionId !== bound.sessionId)
    ) {
      mailbox.invalidate();
      return { state: 'ACCOUNT_CHANGED' };
    }
    pending = true;
    try {
      const result = await (connect ? mailbox.connect() : mailbox.check());
      if (!(await account.current(bound))) {
        mailbox.invalidate();
        return { state: 'SIGN_IN_REQUIRED' };
      }
      if (result.state === 'CONNECTED') owner = bound;
      return mailbox.snapshot();
    } finally {
      pending = false;
    }
  };
  return {
    connect: () => run(true),
    check: () => run(false),
    async disconnect() {
      // Cleanup remains available even when Clerk is unavailable or switched.
      const result = await mailbox.disconnect();
      owner = undefined;
      return result;
    },
  };
}
