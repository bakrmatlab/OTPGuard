import { recipientMatches } from '../../../packages/security/generic';
import type { Context, Envelope, Adapter } from '../pipeline/coordinator';
import type { AccountGate } from '../account/gate';
import type { createGmailLifecycle } from './lifecycle';
import { createMailboxCoordinator } from './connected';
import { createGmailTransport, RetrievalFailure } from './transport';
import {
  clearlyUnrelatedMail,
  rawEmailHints,
  type RawEmailIssue,
} from '../../../packages/otp/raw';
import { normalizeRawEmail, parseGenericCode } from '../../../packages/otp';

export type RetrievalIssue =
  | 'quota'
  | 'network'
  | 'limit'
  | 'schema'
  | 'mime'
  | `mime-${RawEmailIssue}`
  | 'mailbox';

// Mail delivery/indexing can lag the challenge. Keep looking within the same
// bounded request window, leaving time for verification and the owner's click.
const schedule = [0, 2000, 6000, 12000, 22000, 32000, 42000];
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new RetrievalFailure('network'));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RetrievalFailure('network'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
function cancellable<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new RetrievalFailure('network'));
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new RetrievalFailure('network'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void operation().then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
/** One volatile run per exact account/session/mailbox/service/window. No cached mail. */
export function createRetrievalEngine(deps: {
  now(): number;
  progress?(stage: import('../pipeline/progress').ProgressStage): void;
  current(context: Context): Promise<boolean>;
  cycle(
    context: Context,
    startedAt: number,
    signal: AbortSignal,
  ): Promise<readonly Envelope[] | null>;
}) {
  const runs = new Map<
    string,
    {
      abort: AbortController;
      users: number;
      result: Promise<readonly Envelope[] | null>;
    }
  >();
  let quotaUntil = 0;
  return {
    async retrieve(context: Context, signal: AbortSignal) {
      try {
        if (
          !(await cancellable(() => deps.current(context), signal)) ||
          signal.aborted
        )
          return null;
      } catch {
        return null;
      }
      const admittedAt = Math.floor(deps.now() / 1000) * 1000;
      const startedAt = context.requestWindow?.startedAt ?? admittedAt;
      const key = JSON.stringify([
        context.accountId,
        context.accountSession,
        context.mailboxId,
        context.serviceId,
        startedAt,
        context.requestWindow,
      ]);
      let run = runs.get(key);
      if (!run) {
        if (runs.size >= 20) return null;
        const abort = new AbortController();
        const combined = abort.signal;
        const deadlineTimer = setTimeout(
          () => abort.abort(),
          Math.max(0, admittedAt + 60_000 - deps.now()),
        );
        const result = (async () => {
          let failed = false;
          try {
            for (const elapsed of schedule) {
              const target = Math.max(admittedAt + elapsed, quotaUntil);
              if (target >= admittedAt + 60_000) return null;
              deps.progress?.('polling');
              await wait(Math.max(0, target - deps.now()), combined);
              if (
                !(await cancellable(() => deps.current(context), combined)) ||
                combined.aborted ||
                deps.now() >= admittedAt + 60_000
              )
                return null;
              try {
                const mail = await cancellable(
                  () => deps.cycle(context, startedAt, combined),
                  combined,
                );
                if (
                  combined.aborted ||
                  !(await cancellable(() => deps.current(context), combined))
                )
                  return null;
                if (mail === null || mail.length > 10) return null;
                failed = false;
                if (mail.length) return mail;
                deps.progress?.('polling');
              } catch (error) {
                failed = true;
                if (
                  error instanceof RetrievalFailure &&
                  error.reason === 'quota'
                )
                  quotaUntil = Math.max(quotaUntil, error.retryAt);
                else if (
                  !(error instanceof RetrievalFailure) ||
                  error.reason !== 'network'
                )
                  return null;
              }
            }
            return failed ? null : [];
          } catch {
            return null;
          } finally {
            clearTimeout(deadlineTimer);
          }
        })();
        run = { abort, users: 0, result };
        runs.set(key, run);
        void result.finally(() => runs.delete(key));
      }
      const owned = run;
      owned.users++;
      const detach = () => {
        if (--owned.users === 0) owned.abort.abort();
      };
      return new Promise<readonly Envelope[] | null>((resolve) => {
        let done = false;
        const finish = (value: readonly Envelope[] | null) => {
          if (done) return;
          done = true;
          signal.removeEventListener('abort', cancelled);
          detach();
          resolve(value);
        };
        const cancelled = () => finish(null);
        signal.addEventListener('abort', cancelled, { once: true });
        if (signal.aborted) finish(null);
        void owned.result.then(finish);
      });
    },
    cancelAll() {
      for (const run of runs.values()) run.abort.abort();
    },
  };
}

/** Shared raw-mail pilot retrieval, entered through both account boundaries. */
export function createGmailPageCoordinator(
  browser: Omit<Adapter, 'retrieve' | 'registry'>,
  account: AccountGate,
  mailbox: ReturnType<typeof createGmailLifecycle>,
  transport = createGmailTransport(),
  ensureMailbox = () => mailbox.check(),
  onFailure: (issue: RetrievalIssue | null) => void = () => {},
) {
  const engine = createRetrievalEngine({
    now: browser.now,
    progress: (stage) => browser.progress?.(stage),
    async current(context) {
      return (
        !!context.accountSession &&
        (await account.current(context.accountSession)) &&
        mailbox.snapshot().state === 'CONNECTED' &&
        mailbox.snapshot().mailbox === context.mailboxId &&
        (await browser.current(context))
      );
    },
    async cycle(context, startedAt, signal) {
      onFailure(null);
      if (
        !context.accountSession ||
        !(await account.current(context.accountSession)) ||
        signal.aborted
      )
        return null;
      let raw;
      try {
        raw = await mailbox.withMailbox(
          context.mailboxId,
          signal,
          (token, authorizedSignal) =>
            transport.cycle(
              token,
              [],
              startedAt,
              authorizedSignal,
              'raw',
              true,
              context.requestWindow?.notBefore,
              browser.now() + 60000,
              browser.progress,
            ),
        );
      } catch (error) {
        onFailure(error instanceof RetrievalFailure ? error.reason : 'network');
        throw error;
      }
      if (!raw || signal.aborted) {
        if (!signal.aborted) onFailure('mailbox');
        return null;
      }
      const envelopes: Envelope[] = [];
      for (const value of raw) {
        const message = value as {
          id?: string;
          raw?: string;
          internalDate?: string;
          snippet?: unknown;
        };
        if (
          !message.id ||
          typeof message.raw !== 'string' ||
          message.raw.length > 350000 ||
          !/^[A-Za-z0-9_-]+={0,2}$/.test(message.raw) ||
          !/^\d{1,16}$/.test(message.internalDate ?? '')
        ) {
          onFailure('schema');
          return null;
        }
        let bytes: Uint8Array;
        try {
          bytes = Uint8Array.from(
            atob(message.raw.replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0),
          );
        } catch {
          onFailure('schema');
          return null;
        }
        const receivedAt = Number(message.internalDate);
        if (
          receivedAt <
            (context.requestWindow?.notBefore ?? startedAt - 60000) ||
          receivedAt > browser.now()
        ) {
          browser.progress?.('receipt');
          continue;
        }
        const hints = rawEmailHints(bytes);
        if (
          context.requestWindow?.recipient &&
          hints?.recipients.length &&
          !hints.recipients.some((recipient) =>
            recipientMatches(recipient, context.requestWindow!.recipient!),
          )
        ) {
          browser.progress?.('recipient');
          continue;
        }
        browser.progress?.('decoding');
        let failure: RawEmailIssue | undefined;
        const email = normalizeRawEmail(bytes, true, (issue) => {
          failure = issue;
        });
        if (!email) {
          if (clearlyUnrelatedMail(bytes, message.snippet)) {
            browser.progress?.('unrelated');
            continue;
          }
          onFailure(`mime-${failure ?? 'headers'}`);
          return null;
        }
        browser.progress?.('selecting');
        const parsed = parseGenericCode(email);
        if (parsed.status === 'rejected') {
          browser.progress?.(
            parsed.reason === 'unsupported-purpose'
              ? 'purpose'
              : parsed.reason === 'quoted-or-forwarded'
                ? 'quoted'
                : 'template',
          );
          continue;
        }
        if (
          parsed.status === 'candidate' &&
          context.requestWindow?.allowedLengths &&
          !context.requestWindow.allowedLengths.includes(
            parsed.candidate.code.length,
          )
        ) {
          browser.progress?.('length');
          continue;
        }
        if (
          parsed.status === 'candidate' &&
          context.requestWindow?.expectedLength &&
          parsed.candidate.code.length !== context.requestWindow.expectedLength
        ) {
          browser.progress?.('length');
          continue;
        }
        envelopes.push({
          messageId: message.id,
          mailboxId: context.mailboxId,
          receivedAt,
          ...(hints
            ? {
                recipients: hints.recipients,
                ...(hints.senderDomain
                  ? { senderDomain: hints.senderDomain }
                  : {}),
              }
            : {}),
          email,
          sender: { status: 'unknown' },
        });
      }
      return envelopes;
    },
  });
  const coordinator = createMailboxCoordinator(
    {
      ...browser,
      settings:
        browser.settings ??
        (() => ({ autofillEnabled: false, blockedOrigins: [] })),
      registry: [],
      mode: 'user-confirmed',
      retrieve: engine.retrieve,
    },
    account,
    mailbox,
    ensureMailbox,
  );
  const stopAccount = account.subscribe(engine.cancelAll);
  const stopMailbox = mailbox.subscribe(engine.cancelAll);
  return {
    ...coordinator,
    dispose() {
      engine.cancelAll();
      stopAccount();
      stopMailbox();
      coordinator.dispose();
    },
  };
}
