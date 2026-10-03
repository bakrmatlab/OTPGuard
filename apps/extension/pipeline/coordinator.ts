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
export interface Adapter {
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
  | { state: 'IDLE' | 'SEARCHING' | 'FILLED' | 'CANCELLED' | 'ERROR' }
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
  let status: LocalStatus = { state: 'IDLE' };
  const cancel = (request: Request) => {
    request.abort.abort();
    requests.delete(request.id);
    status = { state: 'CANCELLED' };
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
  return {
    status: () => status,
    cancelAll() {
      for (const request of requests.values()) cancel(request);
    },
    cancelTab(tabId: number) {
      for (const request of requests.values())
        if (request.context.tabId === tabId) cancel(request);
    },
    async handle(
      value: unknown,
      sender: chrome.runtime.MessageSender,
    ): Promise<LocalStatus> {
      const message = parseClient(value);
      if (!message) return { state: 'UNKNOWN', reason: 'request' };
      const context = await adapter.context(sender);
      if (!context) return { state: 'UNKNOWN', reason: 'request' };
      if (message.type === 'cancel') {
        const request = requests.get(message.requestId);
        if (request && same(context, request.context)) cancel(request);
        return status;
      }
      if (!context.foreground || !message.emailFlow)
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
      const timer = setTimeout(() => cancel(request), 60_000);
      try {
        const envelopes = await adapter.retrieve(context, request.abort.signal);
        if (!(await alive(request))) return (status = { state: 'CANCELLED' });
        if (!envelopes || envelopes.length > 10)
          return (status = { state: 'UNKNOWN', reason: 'ambiguity' });
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
              locallyBlocked: false,
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
        status = decide();
        if (status.state !== 'VERIFIED') return status;
        const expiresAt = Math.min(adapter.now() + 30_000, request.deadline);
        const binding = {
          requestId: request.id,
          groupId: request.groupId,
          expectedLength: request.length,
          expiresAt,
        };
        const ready = await adapter.send(context, {
          ...binding,
          type: 'prepare',
        });
        if (
          ready !== true ||
          !(await alive(request)) ||
          adapter.now() >= expiresAt
        )
          return (status = { state: 'CANCELLED' });
        status = decide();
        if (status.state !== 'VERIFIED') return status;
        const parsed = messages[0]!.parsed;
        if (parsed.status !== 'candidate') return (status = { state: 'ERROR' });
        const result = await adapter.send(context, {
          ...binding,
          type: 'release',
          code: parsed.candidate.code,
        });
        return (status =
          result === true ? { state: 'FILLED' } : { state: 'CANCELLED' });
      } catch {
        return (status = {
          state: request.abort.signal.aborted ? 'CANCELLED' : 'ERROR',
        });
      } finally {
        clearTimeout(timer);
        requests.delete(request.id);
      }
    },
  };
}
