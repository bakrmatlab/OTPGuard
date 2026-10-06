import type { ParseResult, Purpose, CodeCandidate } from '@otpguard/otp';

/** Shipped policy only. Page content and synchronized settings cannot add entries. */
export interface ServicePolicy {
  id: string;
  name: string;
  origins: readonly string[];
  senders: readonly {
    address: string;
    /** Exact authenticated domain and receiving-boundary adapter relationship. */
    authenticatedDomain: string;
    boundaryId: string;
    method: 'aligned-dkim' | 'aligned-dmarc';
  }[];
  templates: readonly CodeCandidate['template'][];
  purposes: readonly Purpose[];
  codeLengths: readonly number[];
  evidenceContract?: 'signed-content-pilot';
  selector?: string;
  emailTemplate?: { subject: RegExp; instruction: RegExp };
  maxAgeMs: number;
  provenance: string;
  validatedOn: string;
}
/** Owner-controlled pilot mapping. No direct-receipt claim. */
export const supportedServices: readonly ServicePolicy[] = Object.freeze([
  {
    id: 'canva',
    name: 'Canva',
    origins: ['https://www.canva.com'],
    senders: [
      {
        address: 'no-reply@account.canva.com',
        authenticatedDomain: 'account.canva.com',
        boundaryId: 'raw-dkim-google-doh-pilot',
        method: 'aligned-dkim' as const,
      },
    ],
    templates: ['inline' as const],
    purposes: ['sign-in' as const],
    codeLengths: [6],
    evidenceContract: 'signed-content-pilot' as const,
    selector: 'rsp6babxccyfzajomulkoj3m6cqtnhls',
    emailTemplate: {
      subject: /^Your login code is [0-9]{6}$/,
      instruction:
        /Enter this code within the next 10 minutes to log in to your Canva Account\./,
    },
    maxAgeMs: 300_000,
    provenance:
      'Owner controlled signed plain-text evidence; receipt/replay unproven; documentation/core-2-canva-evidence.md',
    validatedOn: '2026-10-04',
  },
]);

/** Produced only by a trusted adapter, never by interpreting page or raw header claims.
 * These types are a contract, not a cryptographic attestation. The future background
 * boundary must validate adapter provenance and bind evidence to the fetched message.
 */
export type SenderEvidence =
  | { status: 'unknown' | 'failed' }
  | {
      status: 'authenticated';
      messageId: string;
      mailboxId: string;
      address: string;
      authenticatedDomain: string;
      boundaryId: string;
      method: 'aligned-dkim' | 'aligned-dmarc';
      delivery: 'direct' | 'unverified';
      signedAt?: number;
    };
export interface MessageEvidence {
  messageId: string;
  mailboxId: string;
  /** Trusted provider receipt time, not the sender-controlled Date header. */
  receivedAt: number;
  sender: SenderEvidence;
  parsed: ParseResult;
}
/** Caller supplies browser-derived, current context and complete ambiguity evidence.
 * No title, logo, claimed service, email link, parser score or page domain hint is used.
 */
export interface AuthorizationInput {
  serviceId: string;
  now: number;
  locallyBlocked: boolean;
  request: {
    mailboxId: string;
    startedAt: number;
    /** Generic-only receipt floor; coordinator-owned, not sender time. */
    receiptNotBefore?: number;
    deadline: number;
    /** Generic-only worker-observed phases; a click does not replace current authority. */
    confirmation?: { offeredAt: number; clickedAt?: number };
    url: string;
    topLevel: boolean;
    current: boolean;
    foreground: boolean;
    emailFlow: boolean;
    purpose: Purpose;
    expectedLength: number;
    /** Complete enumeration by the trusted coordinator; unknown is insufficient. */
    competingChallenges: number | null;
  };
  /** Complete plausible same-service message set; never preselect the newest. */
  messages: readonly MessageEvidence[];
}
export type Reason =
  | 'local-block'
  | 'unsupported-service'
  | 'destination'
  | 'request'
  | 'ambiguity'
  | 'sender'
  | 'message-binding'
  | 'freshness'
  | 'code';
export type Decision =
  | { state: 'VERIFIED'; serviceId: string }
  | { state: 'UNKNOWN'; reason: Reason }
  | { state: 'MISMATCH'; reason: 'destination' | 'sender' }
  | { state: 'BLOCKED'; reason: 'local-block' };

/** WHATWG canonicalization includes ASCII IDNA and default HTTPS port handling.
 * No suffix/subdomain authorization: no registrable-domain calculation is needed.
 */
export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null;
    if (url.hostname.endsWith('.')) return null;
    return url.origin;
  } catch {
    return null;
  }
}
const timestamp = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
const unknown = (reason: Reason): Decision => ({ state: 'UNKNOWN', reason });

/** Pure decision only: never returns a code, sends messages, stores data or fills. */
export function authorize(
  input: AuthorizationInput,
  registry: readonly ServicePolicy[] = supportedServices,
): Decision {
  if (input.locallyBlocked) return { state: 'BLOCKED', reason: 'local-block' };
  const policies = registry.filter((policy) => policy.id === input.serviceId);
  if (policies.length !== 1) return unknown('unsupported-service');
  const policy = policies[0]!;
  const origin = normalizeOrigin(input.request.url);
  // Registry values must themselves be origins, not URLs with ignored paths/claims.
  if (
    !origin ||
    !policy.origins.some(
      (approved) =>
        approved === origin && normalizeOrigin(approved) === approved,
    )
  )
    return { state: 'MISMATCH', reason: 'destination' };
  const request = input.request;
  if (
    !timestamp(input.now) ||
    !timestamp(request.startedAt) ||
    !timestamp(request.deadline) ||
    input.now < request.startedAt ||
    input.now >= request.deadline ||
    request.deadline - request.startedAt > 60_000 ||
    !request.mailboxId ||
    !request.topLevel ||
    !request.current ||
    !request.foreground ||
    !request.emailFlow
  )
    return unknown('request');
  if (request.competingChallenges !== 0 || input.messages.length !== 1)
    return unknown('ambiguity');
  const message = input.messages[0]!;
  if (!message.messageId || message.mailboxId !== request.mailboxId)
    return unknown('message-binding');
  const sender = message.sender;
  if (sender.status !== 'authenticated') return unknown('sender');
  if (
    sender.messageId !== message.messageId ||
    sender.mailboxId !== message.mailboxId ||
    (policy.evidenceContract === 'signed-content-pilot'
      ? sender.delivery !== 'unverified' ||
        !timestamp(sender.signedAt ?? -1) ||
        sender.signedAt! > input.now ||
        input.now - sender.signedAt! > 300_000 ||
        sender.signedAt! < request.startedAt - 60_000
      : sender.delivery !== 'direct')
  )
    return unknown('message-binding');
  if (
    !policy.senders.some(
      (rule) =>
        rule.address === sender.address &&
        rule.authenticatedDomain === sender.authenticatedDomain &&
        rule.boundaryId === sender.boundaryId &&
        rule.method === sender.method,
    )
  )
    return { state: 'MISMATCH', reason: 'sender' };
  if (
    !timestamp(message.receivedAt) ||
    message.receivedAt > input.now ||
    !Number.isSafeInteger(policy.maxAgeMs) ||
    policy.maxAgeMs <= 0 ||
    input.now - message.receivedAt > Math.min(policy.maxAgeMs, 300_000) ||
    message.receivedAt < request.startedAt - 60_000
  )
    return unknown('freshness');
  if (message.parsed.status === 'ambiguous') return unknown('ambiguity');
  if (message.parsed.status !== 'candidate') return unknown('code');
  const candidate = message.parsed.candidate;
  if (
    !/^[0-9]{4,8}$/.test(candidate.code) ||
    candidate.code.length !== request.expectedLength ||
    !policy.codeLengths.includes(candidate.code.length) ||
    candidate.purpose !== request.purpose ||
    !policy.purposes.includes(candidate.purpose) ||
    !policy.templates.includes(candidate.template)
  )
    return unknown('code');
  return { state: 'VERIFIED', serviceId: policy.id };
}

export { assessGmailSender } from './gmail';
export type { GmailSenderAssessment } from './gmail';
