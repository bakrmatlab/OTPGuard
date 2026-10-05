import type { AccountBinding, AccountGate } from '../account/gate';
import type { createGmailLifecycle, MailboxStatus } from './lifecycle';
import {
  mailboxDigest,
  ownerDigest,
  parseRememberedMailbox,
  rememberMailbox,
  type RememberedMailboxStore,
} from './remembered';

/** Bind local mailbox consent to the selected Clerk session, without equating emails. */
export function createAuthenticatedMailbox(
  account: AccountGate,
  mailbox: ReturnType<typeof createGmailLifecycle>,
  remembered?: RememberedMailboxStore,
) {
  let owner: Pick<AccountBinding, 'userId' | 'sessionId'> | undefined;
  let pending = false;
  let epoch = 0;
  let disconnecting = false;
  let queued = Promise.resolve();
  let checking: Promise<MailboxStatus> | undefined;
  account.subscribe(() => {
    epoch++;
    if (owner || pending) mailbox.invalidate();
  });
  const run = async (connect: boolean): Promise<MailboxStatus> => {
    if (mailbox.snapshot().state === 'UNCONFIGURED') return mailbox.snapshot();
    const bound = await account.refresh(true);
    if (!bound) return { state: 'SIGN_IN_REQUIRED' };
    if (disconnecting) return { state: 'DISCONNECTING' };
    if (
      owner &&
      (owner.userId !== bound.userId || owner.sessionId !== bound.sessionId)
    ) {
      mailbox.invalidate();
      await remembered?.remove();
      return { state: 'ACCOUNT_CHANGED' };
    }
    const before = epoch;
    pending = true;
    try {
      let result: MailboxStatus;
      if (!connect && remembered && mailbox.snapshot().state !== 'CONNECTED') {
        const raw = await remembered.read();
        const saved = parseRememberedMailbox(raw);
        if (raw !== undefined && !saved) return { state: 'RECONNECT_REQUIRED' };
        if (!saved) return mailbox.snapshot();
        if ((await ownerDigest(bound)) !== saved.ownerDigest) {
          await remembered.remove();
          return { state: 'ACCOUNT_CHANGED' };
        }
        if (
          before !== epoch ||
          disconnecting ||
          !(await account.current(bound))
        )
          return { state: 'SIGN_IN_REQUIRED' };
        result = await mailbox.restore(
          async (selected) =>
            before === epoch &&
            !disconnecting &&
            (await mailboxDigest(saved.ownerDigest, selected)) ===
              saved.mailboxDigest &&
            (await account.current(bound)) &&
            before === epoch &&
            !disconnecting,
        );
      } else {
        result = await (connect ? mailbox.connect() : mailbox.check());
      }
      if (
        !(await account.current(bound)) ||
        before !== epoch ||
        disconnecting
      ) {
        mailbox.invalidate();
        return { state: 'SIGN_IN_REQUIRED' };
      }
      if (result.state === 'CONNECTED') {
        if (connect && remembered) {
          await remembered.write(await rememberMailbox(bound, result.mailbox!));
          if (
            before !== epoch ||
            disconnecting ||
            !(await account.current(bound))
          ) {
            await remembered.remove();
            mailbox.invalidate();
            return { state: 'SIGN_IN_REQUIRED' };
          }
        }
        owner = bound;
      }
      return mailbox.snapshot();
    } catch {
      mailbox.invalidate();
      return { state: 'RECONNECT_REQUIRED' };
    } finally {
      pending = false;
    }
  };
  const serialize = (connect: boolean) => {
    const result = queued.then(() => run(connect));
    queued = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  return {
    connect: () => serialize(true),
    check() {
      if (checking) return checking;
      const result = serialize(false);
      checking = result;
      void result.finally(() => {
        if (checking === result) checking = undefined;
      });
      return result;
    },
    async disconnect() {
      disconnecting = true;
      epoch++;
      mailbox.invalidate();
      // Cleanup remains available even when Clerk is unavailable or switched.
      try {
        await queued;
        await remembered?.remove();
        const result = await mailbox.disconnect();
        owner = undefined;
        return result;
      } finally {
        disconnecting = false;
      }
    },
  };
}
