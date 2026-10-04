import { GMAIL_SCOPE } from './config';
export type MailboxStatus = {
  state:
    | 'UNCONFIGURED'
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'CONNECTED'
    | 'CONNECT_FAILED'
    | 'SCOPE_REQUIRED'
    | 'RECONNECT_REQUIRED'
    | 'MAILBOX_CHANGED'
    | 'DISCONNECTING'
    | 'DISCONNECTED_REVOCATION_UNCONFIRMED'
    | 'DISCONNECTED_CACHE_CLEAR_FAILED';
  mailbox?: string;
};
export interface GmailAdapter {
  token(
    interactive: boolean,
  ): Promise<{ token?: string; grantedScopes?: string[] }>;
  profile(token: string, signal: AbortSignal): Promise<string>;
  remove(token: string): Promise<void>;
  clear(): Promise<void>;
  revoke(token: string): Promise<boolean>;
}
export class GmailUnauthorized extends Error {}
/** Worker-owned, memory-only mailbox state. Tokens are scoped to each operation. */
export function createGmailLifecycle(
  adapter: GmailAdapter,
  configured: boolean,
) {
  let status: MailboxStatus = {
    state: configured ? 'DISCONNECTED' : 'UNCONFIGURED',
  };
  let mailbox: string | undefined;
  let generation = 0;
  let disconnecting = false;
  let operation: Promise<MailboxStatus> | undefined;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  const mailGrants = new Set<Promise<void>>();
  const snapshot = () => ({ ...status });
  const cancel = () => {
    generation++;
    controller?.abort();
    for (const listener of listeners) listener();
  };
  const invalidate = () => {
    cancel();
    if (!disconnecting)
      status = { state: configured ? 'RECONNECT_REQUIRED' : 'UNCONFIGURED' };
  };
  const probe = async (interactive: boolean) => {
    const before = generation;
    const abort = new AbortController();
    controller = abort;
    let token: string | undefined;
    try {
      const grant = await adapter.token(interactive);
      token = grant.token;
      if (!token || !grant.grantedScopes?.includes(GMAIL_SCOPE)) {
        if (token) await adapter.remove(token);
        if (before === generation) {
          cancel();
          status = { state: 'SCOPE_REQUIRED' };
        }
        return snapshot();
      }
      if (before !== generation) {
        await adapter.remove(token);
        return snapshot();
      }
      let next: string;
      try {
        next = await adapter.profile(token, abort.signal);
      } catch (error) {
        if (!(error instanceof GmailUnauthorized)) throw error;
        await adapter.remove(token);
        if (before !== generation) return snapshot();
        // One noninteractive refresh only; Chrome manages expiry/cache. Never prompt on retry.
        const fresh = await adapter.token(false);
        token = fresh.token;
        if (!token || !fresh.grantedScopes?.includes(GMAIL_SCOPE))
          throw new GmailUnauthorized();
        if (before !== generation) {
          await adapter.remove(token);
          return snapshot();
        }
        next = await adapter.profile(token, abort.signal);
      }
      if (before !== generation) return snapshot();
      if (!/^[^\s@]+@[^\s@]+$/.test(next) || next.length > 254)
        throw new Error('Invalid profile');
      if (mailbox && mailbox.toLowerCase() !== next.toLowerCase()) {
        cancel();
        status = { state: 'MAILBOX_CHANGED' };
        await adapter.remove(token);
        return snapshot();
      }
      mailbox = next;
      status = { state: 'CONNECTED', mailbox };
    } catch {
      if (token) {
        try {
          await adapter.remove(token);
        } catch {
          /* Fail closed; disconnect offers full cache cleanup. */
        }
      }
      if (before === generation) {
        cancel();
        status = {
          state: interactive ? 'CONNECT_FAILED' : 'RECONNECT_REQUIRED',
        };
      }
    }
    return snapshot();
  };
  const run = (interactive: boolean) => {
    if (
      !configured ||
      disconnecting ||
      operation ||
      status.state === 'DISCONNECTING' ||
      status.state === 'MAILBOX_CHANGED'
    )
      return operation ?? Promise.resolve(snapshot());
    if (interactive) status = { state: 'CONNECTING' };
    const pending = probe(interactive);
    operation = pending;
    void pending.finally(() => {
      if (operation === pending) operation = undefined;
    });
    return pending;
  };
  return {
    snapshot,
    invalidate,
    /** Worker-only mail operation; no token is exposed by runtime messages. */
    async withMailbox<T>(
      expected: string,
      signal: AbortSignal,
      work: (token: string, signal: AbortSignal) => Promise<T>,
    ): Promise<T | null> {
      if (
        status.state !== 'CONNECTED' ||
        mailbox !== expected ||
        signal.aborted
      )
        return null;
      const before = generation;
      const abort = new AbortController();
      const unsubscribe = (() => {
        const listener = () => abort.abort();
        listeners.add(listener);
        return () => listeners.delete(listener);
      })();
      const combined = AbortSignal.any([
        signal,
        abort.signal,
        AbortSignal.timeout(10_000),
      ]);
      let token: string | undefined;
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (combined.aborted || generation !== before) return null;
          const pendingGrant = adapter.token(false);
          const drained = pendingGrant.then(
            () => {},
            () => {},
          );
          mailGrants.add(drained);
          let grant: Awaited<ReturnType<GmailAdapter['token']>>;
          try {
            grant = await pendingGrant;
          } finally {
            mailGrants.delete(drained);
          }
          token = grant.token;
          if (!token || !grant.grantedScopes?.includes(GMAIL_SCOPE)) {
            if (token) await adapter.remove(token);
            throw new GmailUnauthorized();
          }
          if (combined.aborted || generation !== before) return null;
          try {
            const selected = await adapter.profile(token, combined);
            if (combined.aborted || generation !== before) return null;
            if (selected.toLowerCase() !== expected.toLowerCase()) {
              cancel();
              status = { state: 'MAILBOX_CHANGED' };
              await adapter.remove(token);
              return null;
            }
            const result = await work(token, combined);
            return combined.aborted || generation !== before ? null : result;
          } catch (error) {
            if (!(error instanceof GmailUnauthorized)) throw error;
            await adapter.remove(token);
            if (attempt === 1) throw error;
          }
        }
      } catch (error) {
        if (error instanceof GmailUnauthorized && before === generation)
          invalidate();
        throw error;
      } finally {
        unsubscribe();
      }
      return null;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect: () => run(true),
    check: () =>
      status.state === 'CONNECTED' ? run(false) : Promise.resolve(snapshot()),
    async disconnect() {
      if (!configured) return snapshot();
      if (disconnecting) return snapshot();
      disconnecting = true;
      cancel();
      const expectedMailbox = mailbox;
      mailbox = undefined;
      status = { state: 'DISCONNECTING' };
      // Drain a pending Chrome consent operation before clearing its resulting cached grant.
      if (operation) await operation;
      await Promise.all([...mailGrants]);
      let revoked = false;
      let cleared = false;
      try {
        // A restarted/never-connected worker has no authority to revoke the
        // currently selected Google account. Still clear the local Chrome cache.
        const grant = expectedMailbox ? await adapter.token(false) : {};
        if (grant.token && expectedMailbox) {
          // Never claim revocation of the old mailbox using a newly selected account's token.
          const selected = await adapter.profile(
            grant.token,
            new AbortController().signal,
          );
          if (selected.toLowerCase() === expectedMailbox.toLowerCase())
            revoked = await adapter.revoke(grant.token);
        }
      } catch {
        /* No token means remote revocation cannot be confirmed. */
      }
      try {
        await adapter.clear();
        cleared = true;
      } catch {
        /* Report separately from provider revocation. */
      }
      status = {
        state: !cleared
          ? 'DISCONNECTED_CACHE_CLEAR_FAILED'
          : !revoked
            ? 'DISCONNECTED_REVOCATION_UNCONFIRMED'
            : 'DISCONNECTED',
      };
      disconnecting = false;
      return snapshot();
    },
  };
}
