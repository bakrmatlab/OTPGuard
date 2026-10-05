import {
  parseVerificationCode,
  type NormalizedEmail,
} from '../../../packages/otp';
import {
  authorize,
  type Decision,
  type SenderEvidence,
  type ServicePolicy,
} from '../../../packages/security';
import { parseClient, type WorkerMessage } from './protocol';

export interface Context {
  accountId: string;
  accountSession?: { userId: string; sessionId: string; generation: number };
  mailboxId: string;
  tabId: number;
  documentId: string;
  origin: string;
  browserUrl: string;
  foreground: boolean;
  /** Chosen by the trusted adapter, never by page messages. */
  serviceId: string;
  policyUrl: string;
}
export interface Envelope {
  messageId: string;
  mailboxId: string;
  receivedAt: number;
  sender: SenderEvidence;
  email: NormalizedEmail;
}
export type CancellationReason =
  | 'deadline'
  | 'confirmation'
  | 'binding-expired'
  | 'current-changed'
  | 'prepare-refused'
  | 'release-refused'
  | 'automatic-disabled'
  | 'account-changed'
  | 'mailbox-changed'
  | 'settings-changed'
  | 'navigation'
  | 'tab-changed'
  | 'focus-changed'
  | 'permissions-changed'
  | 'page-cancelled'
  | 'invalidated';
export interface Adapter {
  cancelled?(reason: CancellationReason): void;
  /** Trusted readiness failures only; no page content or identity metadata. */
  contextFailure?(reason: 'account' | 'mailbox' | 'page' | null): void;
  unavailable?(
    sender: chrome.runtime.MessageSender,
    automatic: boolean,
  ): Promise<void>;
  /** Trusted sink gets a closed outcome only; never context, mail or code. Not awaited. */
  activity?(
    outcome: {
      serviceId: string;
      result: 'FILLED' | 'REFUSED' | 'CANCELLED' | 'ERROR';
      reason: import('../../../packages/shared').ActivityEvent['reason'];
      time: number;
    },
    binding?: import('../account/gate').AccountBinding,
  ): Promise<void>;
  subscribeSettings?(listener: () => void): () => void;
  settings?(): { autofillEnabled: boolean; blockedOrigins: readonly string[] };
  confirm?(
    context: Context,
    binding: import('./protocol').Binding,
    signal: AbortSignal,
    automatic: boolean,
  ): Promise<boolean>;
  reserve?(context: Context, messageId: string): Promise<boolean>;
  now(): number;
  id(): string;
  context(sender: chrome.runtime.MessageSender): Promise<Context | null>;
  /** Recheck the bound account/mailbox and browser document/URL/focus after every await. */
  current(context: Context): Promise<boolean>;
  /** Complete bounded plausible set; null means incomplete or failed retrieval. */
  retrieve(
    context: Context,
    signal: AbortSignal,
  ): Promise<readonly Envelope[] | null>;
  send(context: Context, message: WorkerMessage): Promise<unknown>;
  registry: readonly ServicePolicy[];
}
export type LocalStatus =
  | {
      state:
        | 'IDLE'
        | 'SEARCHING'
        | 'NO_CODE'
        | 'FILLED'
        | 'CANCELLED'
        | 'ERROR';
    }
  | Decision;
interface Request {
  context: Context;
  id: string;
  groupId: string;
  length: number;
  startedAt: number;
  deadline: number;
  ambiguous: boolean;
  abort: AbortController;
  cancellation?: CancellationReason;
}
const same = (a: Context, b: Context) =>
  a.accountId === b.accountId &&
  a.mailboxId === b.mailboxId &&
  a.tabId === b.tabId &&
  a.documentId === b.documentId &&
  a.origin === b.origin;
/** Volatile only. Restart discards every request and approval; no secret persistence. */
export function createCoordinator(adapter: Adapter) {
  const requests = new Map<string, Request>();
  const used = new Set<string>();
  let disposed = false;
  let status: LocalStatus = { state: 'IDLE' };
  const stop = (request: Request, reason: CancellationReason): LocalStatus => {
    request.cancellation ??= reason;
    adapter.cancelled?.(request.cancellation);
    return (status = { state: 'CANCELLED' });
  };
  const cancel = (
    request: Request,
    reason: CancellationReason = 'invalidated',
  ) => {
    request.abort.abort();
    requests.delete(request.id);
    stop(request, reason);
  };
  const alive = async (request: Request) => {
    const current = await adapter.current(request.context);
    // Browser queries yield: cancellation/deadlines must be checked after they settle.
    return (
      current &&
      requests.get(request.id) === request &&
      !request.abort.signal.aborted &&
      adapter.now() < request.deadline
    );
  };
  const coordinator = {
    status: () => status,
    cancelAll(reason: CancellationReason = 'invalidated') {
      for (const request of requests.values()) cancel(request, reason);
    },
    cancelTab(tabId: number, reason: CancellationReason = 'navigation') {
      for (const request of requests.values())
        if (request.context.tabId === tabId) cancel(request, reason);
    },
    async recheckAll(reason: CancellationReason = 'current-changed') {
      for (const request of [...requests.values()]) {
        let valid = false;
        try {
          valid = await adapter.current(request.context);
        } catch {
          /* refuse */
        }
        if (!valid && requests.get(request.id) === request)
          cancel(request, reason);
      }
    },
    async handle(
      value: unknown,
      sender: chrome.runtime.MessageSender,
    ): Promise<LocalStatus> {
      if (disposed) return { state: 'CANCELLED' };
      const message = parseClient(value);
      if (!message) return { state: 'UNKNOWN', reason: 'request' };
      const context = await adapter.context(sender);
      if (disposed) return { state: 'CANCELLED' };
      if (!context) {
        status = { state: 'UNKNOWN', reason: 'request' };
        if (message.type === 'detect') {
          try {
            await adapter.unavailable?.(sender, !message.manual);
          } catch {
            // A failed prompt does not authorize retrieval.
          }
        }
        return status;
      }
      if (message.type === 'cancel') {
        const request = requests.get(message.requestId);
        if (request && same(context, request.context))
          cancel(request, 'page-cancelled');
        return status;
      }
      if (!context.foreground || !message.emailFlow)
        return { state: 'UNKNOWN', reason: 'request' };
      const preferences = () =>
        adapter.settings?.() ?? { autofillEnabled: true, blockedOrigins: [] };
      const blocked = () =>
        preferences().blockedOrigins.includes(context.origin);
      const record = (outcome: LocalStatus) => {
        if (['IDLE', 'SEARCHING', 'VERIFIED'].includes(outcome.state)) return;
        try {
          void adapter
            .activity?.(
              {
                serviceId: context.serviceId,
                result:
                  outcome.state === 'FILLED'
                    ? 'FILLED'
                    : outcome.state === 'ERROR'
                      ? 'ERROR'
                      : outcome.state === 'CANCELLED'
                        ? 'CANCELLED'
                        : 'REFUSED',
                reason:
                  'reason' in outcome
                    ? outcome.reason
                    : outcome.state === 'FILLED'
                      ? 'none'
                      : 'delivery',
                time: adapter.now(),
              },
              context.accountSession,
            )
            .catch(() => {});
        } catch {
          /* History cannot affect authorization or release. */
        }
      };
      if (blocked()) {
        const outcome = { state: 'BLOCKED', reason: 'local-block' } as const;
        record(outcome);
        return outcome;
      }
      if (!message.manual && !preferences().autofillEnabled)
        return { state: 'UNKNOWN', reason: 'request' };
      // A document/group gets only one attempt per worker lifetime. No automatic restart/retry.
      const key = `${context.accountId}/${context.mailboxId}/${context.tabId}/${context.documentId}/${message.groupId}`;
      if (used.has(key) || used.size >= 1000)
        return { state: 'UNKNOWN', reason: 'request' };
      used.add(key);
      const startedAt = adapter.now();
      const request: Request = {
        context,
        id: adapter.id(),
        groupId: message.groupId,
        length: message.expectedLength,
        startedAt,
        deadline: startedAt + 60_000,
        ambiguous: message.groupCount !== 1,
        abort: new AbortController(),
      };
      // Latch ambiguity on both requests: cancellation cannot retroactively select a winner.
      for (const other of requests.values())
        if (
          other.context.mailboxId === context.mailboxId &&
          other.context.accountId === context.accountId &&
          other.context.serviceId === context.serviceId
        ) {
          other.ambiguous = true;
          request.ambiguous = true;
        }
      requests.set(request.id, request);
      status = { state: 'SEARCHING' };
      const timer = setTimeout(() => cancel(request, 'deadline'), 60_000);
      try {
        if (blocked())
          return (status = { state: 'BLOCKED', reason: 'local-block' });
        if (!message.manual && !preferences().autofillEnabled)
          return stop(request, 'automatic-disabled');
        const envelopes = await adapter.retrieve(context, request.abort.signal);
        if (!(await alive(request))) return stop(request, 'current-changed');
        if (!envelopes || envelopes.length > 10)
          return (status = { state: 'UNKNOWN', reason: 'ambiguity' });
        if (!envelopes.length) return (status = { state: 'NO_CODE' });
        // Parsing, receipt and sender all come from one adapter envelope, never a runtime claim.
        const messages = envelopes.map(({ email, ...evidence }) => ({
          ...evidence,
          parsed: parseVerificationCode(email),
        }));
        const decide = () =>
          authorize(
            {
              serviceId: context.serviceId,
              now: adapter.now(),
              locallyBlocked: blocked(),
              request: {
                mailboxId: context.mailboxId,
                startedAt,
                deadline: request.deadline,
                url: context.policyUrl,
                topLevel: true,
                current: true,
                foreground: true,
                emailFlow: message.emailFlow,
                purpose: 'sign-in',
                expectedLength: request.length,
                competingChallenges: request.ambiguous ? 1 : 0,
              },
              messages,
            },
            adapter.registry,
          );
        if (!message.manual && !preferences().autofillEnabled)
          return stop(request, 'automatic-disabled');
        status = decide();
        if (status.state !== 'VERIFIED') return status;
        const expiresAt = Math.min(adapter.now() + 30_000, request.deadline);
        const binding = {
          requestId: request.id,
          groupId: request.groupId,
          expectedLength: request.length,
          expiresAt,
        };
        if (
          adapter.confirm &&
          !(await adapter.confirm(
            context,
            binding,
            request.abort.signal,
            !message.manual,
          ))
        )
          return stop(request, 'confirmation');
        if (!(await alive(request))) return stop(request, 'current-changed');
        if (adapter.now() >= expiresAt) return stop(request, 'binding-expired');
        const ready = await adapter.send(context, {
          ...binding,
          type: 'prepare',
        });
        if (ready !== true) return stop(request, 'prepare-refused');
        if (!(await alive(request))) return stop(request, 'current-changed');
        if (adapter.now() >= expiresAt) return stop(request, 'binding-expired');
        if (!message.manual && !preferences().autofillEnabled)
          return stop(request, 'automatic-disabled');
        status = decide();
        if (status.state !== 'VERIFIED') return status;
        const parsed = messages[0]!.parsed;
        if (parsed.status !== 'candidate') return (status = { state: 'ERROR' });
        if (
          adapter.reserve &&
          !(await adapter.reserve(context, messages[0]!.messageId))
        )
          return (status = { state: 'UNKNOWN', reason: 'message-binding' });
        if (!(await alive(request))) return stop(request, 'current-changed');
        if (adapter.now() >= expiresAt) return stop(request, 'binding-expired');
        if (!message.manual && !preferences().autofillEnabled)
          return stop(request, 'automatic-disabled');
        status = decide();
        if (status.state !== 'VERIFIED') return status;
        const result = await adapter.send(context, {
          ...binding,
          type: 'release',
          code: parsed.candidate.code,
        });
        return result === true
          ? (status = { state: 'FILLED' })
          : stop(request, 'release-refused');
      } catch {
        return request.abort.signal.aborted
          ? stop(request, request.cancellation ?? 'invalidated')
          : (status = { state: 'ERROR' });
      } finally {
        clearTimeout(timer);
        requests.delete(request.id);
        if (adapter.confirm) used.delete(key);
        record(status);
      }
    },
  };
  const unsubscribe = adapter.subscribeSettings?.(() =>
    coordinator.cancelAll('settings-changed'),
  );
  return {
    ...coordinator,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      coordinator.cancelAll();
    },
  };
}
