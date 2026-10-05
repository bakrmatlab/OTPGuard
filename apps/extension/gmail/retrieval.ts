import type { Context, Envelope, Adapter } from '../pipeline/coordinator';
import type { AccountGate } from '../account/gate';
import type { createGmailLifecycle } from './lifecycle';
import { createMailboxCoordinator } from './connected';
import { createGmailTransport, RetrievalFailure } from './transport';
import {
  normalizeRawEmail,
  parseVerificationCode,
} from '../../../packages/otp';
import { verifyDkimContent } from '../../../packages/security/dkim';
import { createDkimResolver } from './dns';
import { supportedServices } from '../../../packages/security';

const schedule = [0, 2000, 6000, 12000, 22000];
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
      const startedAt = Math.floor(deps.now() / 1000) * 1000;
      const key = JSON.stringify([
        context.accountId,
        context.accountSession,
        context.mailboxId,
        context.serviceId,
        startedAt,
      ]);
      let run = runs.get(key);
      if (!run) {
        if (runs.size >= 20) return null;
        const abort = new AbortController();
        const combined = abort.signal;
        const deadlineTimer = setTimeout(
          () => abort.abort(),
          Math.max(0, startedAt + 60_000 - deps.now()),
        );
        const result = (async () => {
          let failed = false;
          try {
            for (const elapsed of schedule) {
              const target = Math.max(startedAt + elapsed, quotaUntil);
              if (target >= startedAt + 60_000) return null;
              await wait(Math.max(0, target - deps.now()), combined);
              if (
                !(await cancellable(() => deps.current(context), combined)) ||
                combined.aborted ||
                deps.now() >= startedAt + 60_000
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
) {
  const engine = createRetrievalEngine({
    now: browser.now,
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
      const policy = supportedServices.find((p) => p.id === context.serviceId);
      // Unsupported services refuse before Google I/O.
      if (
        !policy ||
        !context.accountSession ||
        !(await account.current(context.accountSession)) ||
        signal.aborted
      )
        return null;
      const raw = await mailbox.withMailbox(
        context.mailboxId,
        signal,
        (token, authorizedSignal) =>
          transport.cycle(
            token,
            policy.senders.map((s) => s.address),
            startedAt,
            authorizedSignal,
            'raw',
          ),
      );
      if (!raw || signal.aborted) return null;
      const envelopes: Envelope[] = [];
      for (const value of raw) {
        const message = value as {
          id?: string;
          raw?: string;
          internalDate?: string;
        };
        if (
          !message.id ||
          typeof message.raw !== 'string' ||
          message.raw.length > 350000 ||
          !/^[A-Za-z0-9_-]+={0,2}$/.test(message.raw) ||
          !/^\d{1,16}$/.test(message.internalDate ?? '')
        )
          return null;
        let bytes: Uint8Array;
        try {
          bytes = Uint8Array.from(
            atob(message.raw.replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0),
          );
        } catch {
          return null;
        }
        const rule = policy.senders[0];
        if (
          !rule ||
          !policy.selector ||
          policy.evidenceContract !== 'signed-content-pilot'
        )
          return null;
        const verified = await verifyDkimContent(
          bytes,
          {
            signingDomain: rule.authenticatedDomain,
            selector: policy.selector,
            from: rule.address,
            recipient: context.mailboxId,
            now: browser.now(),
            maxAgeSeconds: 300,
          },
          createDkimResolver(),
        );
        if (signal.aborted || verified.status !== 'content-authenticated')
          return null;
        const email = normalizeRawEmail(bytes);
        if (
          !email ||
          !policy.emailTemplate ||
          !policy.emailTemplate.subject.test(email.subject) ||
          !policy.emailTemplate.instruction.test(email.text)
        )
          return null;
        const candidate = parseVerificationCode(email);
        if (
          candidate.status !== 'candidate' ||
          !email.text
            .split(/\r?\n/)
            .some((line) => line.trim() === candidate.candidate.code)
        )
          return null;
        const head = Array.from(bytes, (c) => String.fromCharCode(c))
          .join('')
          .split('\r\n\r\n')[0]!;
        const signatures = head
          .replace(/\r\n[ \t]+/g, ' ')
          .split('\r\n')
          .filter((h) => /^dkim-signature:/i.test(h));
        const signature = signatures.find(
          (h) =>
            h.includes('d=' + rule.authenticatedDomain + ';') &&
            h.includes('s=' + policy.selector + ';'),
        );
        const signedAt =
          Number(/(?:;|:)\s*t=(\d+)/.exec(signature ?? '')?.[1]) * 1000;
        if (!Number.isSafeInteger(signedAt)) return null;
        envelopes.push({
          messageId: message.id,
          mailboxId: context.mailboxId,
          receivedAt: Number(message.internalDate),
          email,
          sender: {
            status: 'authenticated',
            messageId: message.id,
            mailboxId: context.mailboxId,
            address: rule.address,
            authenticatedDomain: rule.authenticatedDomain,
            boundaryId: rule.boundaryId,
            method: rule.method,
            delivery: 'unverified',
            signedAt,
          },
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
      registry: supportedServices,
      retrieve: engine.retrieve,
    },
    account,
    mailbox,
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
