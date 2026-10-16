import type { ParseResult } from '@otpguard/otp';

/** Sender identity is never verified: every message reports an unknown sender. */
export type SenderEvidence = { status: 'unknown' };
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
    expectedLength: number;
    /** Complete enumeration by the trusted coordinator; unknown is insufficient. */
    competingChallenges: number | null;
  };
  /** Complete plausible same-service message set; never preselect the newest. */
  messages: readonly MessageEvidence[];
}
export type Reason =
  | 'local-block'
  | 'request'
  | 'ambiguity'
  | 'message-binding'
  | 'freshness'
  | 'code';
export type Decision =
  | { state: 'UNKNOWN'; reason: Reason }
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
