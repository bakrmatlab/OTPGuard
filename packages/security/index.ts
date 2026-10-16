import type { ParseResult, Purpose } from '@otpguard/otp';

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
