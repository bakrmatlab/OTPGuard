import {
  SEARCH_MS,
  CONFIRM_MS,
  RELEASE_MS,
} from '../../../packages/security/timing';
import { genericRetrievalLimits } from '../../../packages/security/retrieval-limits';
import {
  parseVerificationCode,
  parseGenericCode,
  type NormalizedEmail,
} from '../../../packages/otp';
import {
  authorize,
  type Decision,
  type SenderEvidence,
  type ServicePolicy,
} from '../../../packages/security';
import {
  assessGenericCandidate,
  recipientContradiction,
  genericServiceHint,
  type CandidateDecision,
} from '../../../packages/security/generic';
import { parseClient, type WorkerMessage } from './protocol';

export interface Context {
  requestWindow?: {
    startedAt: number;
    notBefore: number;
    expectedLength: number;
    recipient?: string;
    allowedLengths?: readonly number[];
  };
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
  recipients?: readonly string[];
  senderDomain?: string;
  sender: SenderEvidence;
  email: NormalizedEmail;
}
export type CancellationReason =
  | 'deadline'
  | 'confirmation'
  | 'confirmation-expired'
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
  mode?: 'user-confirmed';
  cancelled?(reason: CancellationReason): void;
  /** Trusted readiness failures only; no page content or identity metadata. */
  contextFailure?(reason: 'account' | 'mailbox' | 'page' | null): void;
  /** Presentation only; never authorizes retrieval or release. */
  detected?(
    sender: chrome.runtime.MessageSender,
    groupId: string,
    signal: AbortSignal,
  ): Promise<void>;
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
  finished?(): void;
  progress?(stage: import('./progress').ProgressStage): void;
  settings?(): { autofillEnabled: boolean; blockedOrigins: readonly string[] };
  confirm?(
    context: Context,
    binding: import('./protocol').Binding,
    signal: AbortSignal,
    automatic: boolean,
  ): Promise<boolean | 'confirmation-expired'>;
  reserve?(
    context: Context,
    messageId: string,
  ): Promise<boolean | 'already-used' | 'unavailable'>;
  now(): number;
  id(): string;
  context(
    sender: chrome.runtime.MessageSender,
    signal?: AbortSignal,
  ): Promise<Context | null>;
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
  | {
      state: 'UNKNOWN';
      reason: 'message-binding';
      replay: 'already-used' | 'unavailable';
    }
  | Decision
  | CandidateDecision;
interface Request {
  context: Context;
  id: string;
  groupId: string;
  length: number;
  startedAt: number;
  deadline: number;
  expiration: CancellationReason;
  confirmation?: { offeredAt: number; clickedAt?: number };
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
  const challengeStarts = new Map<string, number>();
  // Admission completion order is not gesture order: authority checks can stall.
  const documentOrders = new Map<string, number>();
  let nextOrder = 0;
  const browserChallenges = new Map<
    string,
    { startedAt: number; order: number; browserUrl?: string }
  >();
  const browserKey = (tabId: number, documentId: string) =>
    JSON.stringify([tabId, documentId]);
  const windows = new Map<string, { startedAt: number; notBefore: number }>();
  const admissions = new Set<{
    tabId: number | undefined;
    abort: AbortController;
    reason: CancellationReason | undefined;
  }>();
  let disposed = false;
  let status: LocalStatus = { state: 'IDLE' };
  let latestRequest: Request | undefined;
  const stop = (request: Request, reason: CancellationReason): LocalStatus => {
    request.cancellation ??= reason;
    if (latestRequest && latestRequest !== request)
      return { state: 'CANCELLED' };
    adapter.cancelled?.(request.cancellation);
    return (status = { state: 'CANCELLED' });
  };
  const cancel = (
    request: Request,
    reason: CancellationReason = 'invalidated',
  ) => {
    request.abort.abort();
    if (requests.get(request.id) === request) requests.delete(request.id);
    stop(request, reason);
  };
  const bounded = <T>(
    request: Request,
    operation: () => Promise<T>,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      const signal = request.abort.signal;
      if (adapter.now() >= request.deadline)
        cancel(request, request.expiration);
      if (signal.aborted) {
        reject(new Error('Request expired'));
        return;
      }
      const aborted = () => reject(new Error('Request cancelled'));
      signal.addEventListener('abort', aborted, { once: true });
      try {
        void operation().then(
          (value) => {
            signal.removeEventListener('abort', aborted);
            resolve(value);
          },
          (error) => {
            signal.removeEventListener('abort', aborted);
            reject(error);
          },
        );
      } catch (error) {
        signal.removeEventListener('abort', aborted);
        reject(error);
      }
    });
  const alive = async (request: Request) => {
    if (adapter.now() >= request.deadline) cancel(request, request.expiration);
    if (
      requests.get(request.id) !== request ||
      request.abort.signal.aborted ||
      adapter.now() >= request.deadline
    )
      return false;
    try {
      const current = await bounded(request, () =>
        adapter.current(request.context),
      );
      return (
        current &&
        requests.get(request.id) === request &&
        !request.abort.signal.aborted &&
        adapter.now() < request.deadline
      );
    } catch {
      return false;
    }
  };
  const coordinator = {
    status: () => {
      // MV3 timers can be delayed while a worker is suspended. A popup status
      // read must enforce the same deadline instead of reporting stale work.
      for (const request of [...requests.values()])
        if (adapter.now() >= request.deadline)
          cancel(request, request.expiration);
      return status;
    },
    cancelAll(reason: CancellationReason = 'invalidated') {
      for (const admission of admissions) {
        admission.reason = reason;
        admission.abort.abort();
      }
      for (const request of requests.values()) cancel(request, reason);
      windows.clear();
      challengeStarts.clear();
      browserChallenges.clear();
    },
    cancelTab(tabId: number, reason: CancellationReason = 'navigation') {
      if (reason === 'navigation')
        for (const key of browserChallenges.keys())
          if (JSON.parse(key)[0] === tabId) browserChallenges.delete(key);
      for (const admission of admissions)
        if (admission.tabId === tabId) {
          admission.reason = reason;
          admission.abort.abort();
        }
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
      const observedAt = adapter.now();
      const order = ++nextOrder;
      const message = parseClient(value);
      if (!message) return { state: 'UNKNOWN', reason: 'request' };
      const senderKey =
        sender.tab?.id !== undefined &&
        sender.documentId &&
        sender.frameId === 0
          ? browserKey(sender.tab.id, sender.documentId)
          : undefined;
      // Browser metadata permits immediate cancellation, never immediate release.
      // Save the worker-observed gesture before provider checks can reorder events.
      if (
        adapter.mode === 'user-confirmed' &&
        message.type === 'challenge' &&
        senderKey
      ) {
        if (!browserChallenges.has(senderKey) && browserChallenges.size >= 1000)
          return { state: 'UNKNOWN', reason: 'request' };
        browserChallenges.set(senderKey, { startedAt: observedAt, order });
        for (const existing of [...requests.values()])
          if (
            browserKey(existing.context.tabId, existing.context.documentId) ===
            senderKey
          )
            cancel(existing, 'page-cancelled');
      }
      if (message.type === 'detect') adapter.contextFailure?.(null);
      // Admission includes provider/browser awaits. Bound it before those checks,
      // and detach late results without admitting a stale document or request.
      const admission = {
        tabId: sender.tab?.id,
        abort: new AbortController(),
        reason: undefined as CancellationReason | undefined,
      };
      admissions.add(admission);
      const admissionTimer = setTimeout(() => {
        admission.reason = 'deadline';
        admission.abort.abort();
      }, SEARCH_MS);
      if (
        message.type === 'detect' &&
        !message.manual &&
        message.emailFlow &&
        message.groupCount === 1
      )
        void adapter
          .detected?.(sender, message.groupId, admission.abort.signal)
          .catch(() => {});
      let suppliedContext: Context | null;
      try {
        suppliedContext = await new Promise<Context | null>(
          (resolve, reject) => {
            const cancelled = () => resolve(null);
            admission.abort.signal.addEventListener('abort', cancelled, {
              once: true,
            });
            const cleanup = () =>
              admission.abort.signal.removeEventListener('abort', cancelled);
            void adapter.context(sender, admission.abort.signal).then(
              (value) => {
                cleanup();
                resolve(value);
              },
              (error) => {
                cleanup();
                reject(error);
              },
            );
          },
        );
      } catch {
        suppliedContext = null;
        if (!admission.abort.signal.aborted) adapter.contextFailure?.('page');
      } finally {
        clearTimeout(admissionTimer);
        admissions.delete(admission);
      }
      if (
        admission.abort.signal.aborted ||
        adapter.now() >= observedAt + SEARCH_MS
      ) {
        if (
          admission.reason === 'account-changed' ||
          admission.reason === 'mailbox-changed'
        ) {
          adapter.contextFailure?.(
            admission.reason === 'account-changed' ? 'account' : 'mailbox',
          );
          suppliedContext = null;
        } else {
          adapter.cancelled?.(admission.reason ?? 'deadline');
          return (status = { state: 'CANCELLED' });
        }
      }
      const context = suppliedContext ? { ...suppliedContext } : null;
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
      const challengeKey = JSON.stringify([
        context.accountId,
        context.mailboxId,
        context.tabId,
        context.documentId,
        context.origin,
        context.browserUrl,
      ]);
      const observedChallenge =
        senderKey === browserKey(context.tabId, context.documentId)
          ? browserChallenges.get(senderKey)
          : undefined;
      const browserChallenge =
        observedChallenge &&
        (!observedChallenge.browserUrl ||
          observedChallenge.browserUrl === context.browserUrl)
          ? observedChallenge
          : undefined;
      if (browserChallenge) browserChallenge.browserUrl ??= context.browserUrl;
      if (adapter.mode === 'user-confirmed') {
        if (order < (browserChallenge?.order ?? 0))
          return { state: 'CANCELLED' };
        if (order < (documentOrders.get(challengeKey) ?? 0))
          return { state: 'CANCELLED' };
        if (!documentOrders.has(challengeKey) && documentOrders.size >= 1000)
          return { state: 'UNKNOWN', reason: 'request' };
        documentOrders.set(challengeKey, order);
      }
      if (message.type === 'challenge') {
        if (adapter.mode === 'user-confirmed' && context.foreground) {
          if (
            !challengeStarts.has(challengeKey) &&
            challengeStarts.size >= 1000
          )
            challengeStarts.delete(challengeStarts.keys().next().value!);
          challengeStarts.set(challengeKey, observedAt);
          for (const existing of [...requests.values()])
            if (same(existing.context, context))
              cancel(existing, 'page-cancelled');
          windows.set(challengeKey, {
            startedAt: observedAt,
            notBefore: Math.max(0, observedAt - 1000),
          });
        }
        return status;
      }
      if (!context.foreground || !message.emailFlow)
        return { state: 'UNKNOWN', reason: 'request' };
      const preferences = () =>
        adapter.settings?.() ?? { autofillEnabled: true, blockedOrigins: [] };
      const blocked = () =>
        preferences().blockedOrigins.includes(context.origin);
      const record = (outcome: LocalStatus) => {
        if (
          ['IDLE', 'SEARCHING', 'VERIFIED', 'CANDIDATE'].includes(outcome.state)
        )
          return;
        adapter.finished?.();
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
      if (
        adapter.mode === 'user-confirmed' &&
        (message.fresh || message.manual || message.replacement)
      ) {
        for (const existing of [...requests.values()])
          if (
            same(existing.context, context) &&
            (message.fresh ||
              message.replacement ||
              existing.groupId === message.groupId)
          )
            cancel(existing, 'page-cancelled');
        used.delete(key);
      }
      if (used.has(key) || used.size >= 1000)
        return { state: 'UNKNOWN', reason: 'request' };
      used.add(key);
      const startedAt = adapter.now();
      if (adapter.mode === 'user-confirmed') {
        const previous = windows.get(challengeKey);
        const hint =
          browserChallenge?.startedAt ?? challengeStarts.get(challengeKey);
        challengeStarts.delete(challengeKey);
        const earlyStart =
          hint !== undefined && hint <= observedAt && observedAt - hint < 240000
            ? hint
            : undefined;
        const epoch = earlyStart ?? observedAt;
        const window =
          !message.fresh && earlyStart === undefined && previous
            ? previous
            : {
                startedAt: epoch,
                notBefore: Math.max(
                  0,
                  epoch -
                    (message.fresh || earlyStart !== undefined ? 1000 : 60000),
                ),
              };
        if (!windows.has(challengeKey) && windows.size >= 1000)
          windows.delete(windows.keys().next().value!);
        windows.set(challengeKey, window);
        context.requestWindow = {
          ...window,
          expectedLength: message.expectedLength,
          ...(message.allowedLengths
            ? { allowedLengths: message.allowedLengths }
            : {}),
          ...(message.recipient ? { recipient: message.recipient } : {}),
        };
      }
      const request: Request = {
        context,
        id: adapter.id(),
        groupId: message.groupId,
        length: message.expectedLength,
        startedAt,
        deadline: observedAt + SEARCH_MS,
        expiration: 'deadline',
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
      latestRequest = request;
      status = { state: 'SEARCHING' };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const setDeadline = (deadline: number, reason: CancellationReason) => {
        clearTimeout(timer);
        request.deadline = deadline;
        request.expiration = reason;
        timer = setTimeout(
          () => cancel(request, reason),
          Math.max(0, deadline - adapter.now()),
        );
      };
      setDeadline(request.deadline, 'deadline');
      try {
        if (blocked())
          return (status = { state: 'BLOCKED', reason: 'local-block' });
        if (!message.manual && !preferences().autofillEnabled)
          return stop(request, 'automatic-disabled');
        adapter.progress?.('polling');
        const envelopes = await bounded(request, () =>
          adapter.retrieve(context, request.abort.signal),
        );
        if (!(await alive(request))) return stop(request, 'current-changed');
        if (
          !envelopes ||
          envelopes.length >
            (adapter.mode === 'user-confirmed'
              ? genericRetrievalLimits.messages
              : 10)
        ) {
          adapter.progress?.('retrieval-incomplete');
          return (status = { state: 'UNKNOWN', reason: 'ambiguity' });
        }
        adapter.progress?.('selecting');
        let plausible =
          adapter.mode === 'user-confirmed'
            ? envelopes.filter((envelope) => {
                const window = context.requestWindow!;
                if (
                  envelope.receivedAt < window.notBefore ||
                  envelope.receivedAt > adapter.now()
                )
                  return false;
                if (
                  recipientContradiction(envelope.recipients, window.recipient)
                )
                  return false;
                const parsed = parseGenericCode(envelope.email);
                if (
                  parsed.status === 'candidate' &&
                  window.allowedLengths &&
                  !window.allowedLengths.includes(parsed.candidate.code.length)
                )
                  return false;
                return (
                  parsed.status !== 'rejected' &&
                  !(
                    parsed.status === 'candidate' &&
                    request.length !== 0 &&
                    parsed.candidate.code.length !== request.length
                  )
                );
              })
            : envelopes;
        if (
          adapter.mode === 'user-confirmed' &&
          plausible.some(
            (envelope) =>
              genericServiceHint(
                context.origin,
                envelope.senderDomain,
                envelope.email.subject,
              ) === 'match',
          )
        )
          plausible = plausible.filter(
            (envelope) =>
              genericServiceHint(
                context.origin,
                envelope.senderDomain,
                envelope.email.subject,
              ) !== 'different',
          );
        if (!plausible.length) return (status = { state: 'NO_CODE' });
        // Parsing, receipt and sender all come from one adapter envelope, never a runtime claim.
        const messages = plausible.map(({ email, ...evidence }) => ({
          ...evidence,
          parsed:
            adapter.mode === 'user-confirmed'
              ? parseGenericCode(email)
              : parseVerificationCode(email),
        }));
        const decide = () =>
          (adapter.mode === 'user-confirmed'
            ? assessGenericCandidate
            : authorize)(
            {
              serviceId: context.serviceId,
              now: adapter.now(),
              locallyBlocked: blocked(),
              request: {
                mailboxId: context.mailboxId,
                startedAt,
                ...(adapter.mode === 'user-confirmed'
                  ? { receiptNotBefore: context.requestWindow!.notBefore }
                  : {}),
                deadline: request.deadline,
                ...(request.confirmation
                  ? { confirmation: request.confirmation }
                  : {}),
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
        if (
          adapter.mode === 'user-confirmed' &&
          status.state === 'UNKNOWN' &&
          status.reason === 'ambiguity'
        )
          adapter.progress?.(
            request.ambiguous
              ? 'requests-ambiguous'
              : messages.length !== 1
                ? 'messages-ambiguous'
                : 'codes-ambiguous',
          );
        if (status.state !== 'VERIFIED' && status.state !== 'CANDIDATE')
          return status;
        if (adapter.mode === 'user-confirmed' && !adapter.confirm)
          return (status = { state: 'UNKNOWN', reason: 'request' });
        if (adapter.mode === 'user-confirmed') {
          if (adapter.now() >= request.deadline)
            return stop(request, 'deadline');
          request.confirmation = { offeredAt: adapter.now() };
          setDeadline(adapter.now() + CONFIRM_MS, 'confirmation-expired');
        }
        let expiresAt = Math.min(adapter.now() + CONFIRM_MS, request.deadline);
        const binding = {
          requestId: request.id,
          groupId: request.groupId,
          expectedLength:
            messages[0]!.parsed.status === 'candidate'
              ? messages[0]!.parsed.candidate.code.length
              : request.length,
          expiresAt,
        };
        if (adapter.confirm) {
          adapter.progress?.('approval');
          const confirmed = await bounded(request, () =>
            adapter.confirm!(
              context,
              binding,
              request.abort.signal,
              !message.manual,
            ),
          );
          if (confirmed !== true)
            return stop(
              request,
              confirmed === 'confirmation-expired' ? confirmed : 'confirmation',
            );
        }
        if (adapter.now() >= expiresAt || request.abort.signal.aborted)
          return stop(request, 'confirmation-expired');
        if (request.confirmation) {
          request.confirmation.clickedAt = adapter.now();
          expiresAt = adapter.now() + RELEASE_MS;
          binding.expiresAt = expiresAt;
          setDeadline(expiresAt, 'binding-expired');
        }
        if (!(await alive(request))) return stop(request, 'current-changed');
        if (adapter.now() >= expiresAt) return stop(request, 'binding-expired');
        if (blocked())
          return (status = { state: 'BLOCKED', reason: 'local-block' });
        if (!message.manual && !preferences().autofillEnabled)
          return stop(request, 'automatic-disabled');
        adapter.progress?.('preparing');
        const ready = await bounded(request, () =>
          adapter.send(context, {
            ...binding,
            type: 'prepare',
          }),
        );
        if (ready !== true) return stop(request, 'prepare-refused');
        if (!(await alive(request))) return stop(request, 'current-changed');
        if (adapter.now() >= expiresAt) return stop(request, 'binding-expired');
        if (!message.manual && !preferences().autofillEnabled)
          return stop(request, 'automatic-disabled');
        status = decide();
        if (status.state !== 'VERIFIED' && status.state !== 'CANDIDATE')
          return status;
        const parsed = messages[0]!.parsed;
        if (parsed.status !== 'candidate') return (status = { state: 'ERROR' });
        adapter.progress?.('replay');
        if (adapter.reserve) {
          const reserved = await bounded(request, () =>
            adapter.reserve!(context, messages[0]!.messageId),
          );
          if (reserved !== true)
            return (status =
              reserved === 'already-used' || reserved === 'unavailable'
                ? {
                    state: 'UNKNOWN',
                    reason: 'message-binding',
                    replay: reserved,
                  }
                : { state: 'UNKNOWN', reason: 'message-binding' });
        }
        if (!(await alive(request))) return stop(request, 'current-changed');
        if (adapter.now() >= expiresAt) return stop(request, 'binding-expired');
        if (!message.manual && !preferences().autofillEnabled)
          return stop(request, 'automatic-disabled');
        status = decide();
        if (status.state !== 'VERIFIED' && status.state !== 'CANDIDATE')
          return status;
        adapter.progress?.('filling');
        const result = await bounded(request, () =>
          adapter.send(context, {
            ...binding,
            type: 'release',
            code: parsed.candidate.code,
          }),
        );
        return result === true
          ? (status = { state: 'FILLED' })
          : stop(request, 'release-refused');
      } catch {
        return request.abort.signal.aborted
          ? stop(request, request.cancellation ?? 'invalidated')
          : (status = { state: 'ERROR' });
      } finally {
        clearTimeout(timer);
        if (requests.get(request.id) === request) requests.delete(request.id);
        if (
          adapter.confirm &&
          ![...requests.values()].some(
            (other) =>
              same(other.context, context) && other.groupId === message.groupId,
          )
        )
          used.delete(key);
        if (latestRequest === request) record(status);
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
      windows.clear();
      challengeStarts.clear();
      documentOrders.clear();
      browserChallenges.clear();
    },
  };
}
