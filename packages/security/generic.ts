import { SEARCH_MS, CONFIRM_MS, RELEASE_MS } from './timing';
import {
  normalizeOrigin,
  type AuthorizationInput,
  type Decision,
} from './index';

export type CandidateDecision =
  | { state: 'CANDIDATE' }
  | Exclude<Decision, { state: 'VERIFIED' }>;
/** Explicit user-confirmed mode. Never claims a sender-to-website association. */
export function assessGenericCandidate(
  input: AuthorizationInput,
): CandidateDecision {
  const refuse = (reason: import('./index').Reason): CandidateDecision => ({
    state: 'UNKNOWN',
    reason,
  });
  if (input.locallyBlocked) return { state: 'BLOCKED', reason: 'local-block' };
  const r = input.request;
  if (
    !normalizeOrigin(r.url) ||
    !r.current ||
    !r.foreground ||
    !r.topLevel ||
    !r.emailFlow ||
    !r.mailboxId ||
    !Number.isSafeInteger(input.now) ||
    !Number.isSafeInteger(r.startedAt) ||
    !Number.isSafeInteger(r.deadline) ||
    r.startedAt < 0 ||
    input.now < r.startedAt ||
    input.now >= r.deadline ||
    (!r.confirmation && r.deadline - r.startedAt > SEARCH_MS)
  )
    return refuse('request');
  const phase = r.confirmation;
  if (phase) {
    if (
      !Number.isSafeInteger(phase.offeredAt) ||
      phase.offeredAt < r.startedAt ||
      phase.offeredAt >= r.startedAt + SEARCH_MS ||
      input.now < phase.offeredAt ||
      (phase.clickedAt === undefined
        ? r.deadline > phase.offeredAt + CONFIRM_MS
        : !Number.isSafeInteger(phase.clickedAt) ||
          phase.clickedAt < phase.offeredAt ||
          phase.clickedAt >= phase.offeredAt + CONFIRM_MS ||
          input.now < phase.clickedAt ||
          r.deadline > phase.clickedAt + RELEASE_MS)
    )
      return refuse('request');
  }
  if (r.competingChallenges !== 0 || input.messages.length !== 1)
    return refuse('ambiguity');
  if (
    r.receiptNotBefore !== undefined &&
    (!Number.isSafeInteger(r.receiptNotBefore) ||
      r.receiptNotBefore < 0 ||
      r.receiptNotBefore > r.startedAt ||
      r.startedAt - r.receiptNotBefore > 300000)
  )
    return refuse('request');
  const m = input.messages[0]!;
  if (!m.messageId || m.mailboxId !== r.mailboxId)
    return refuse('message-binding');
  if (
    !Number.isSafeInteger(m.receivedAt) ||
    m.receivedAt < 0 ||
    m.receivedAt > input.now ||
    m.receivedAt < (r.receiptNotBefore ?? r.startedAt - 60000) ||
    input.now - m.receivedAt > 300000
  )
    return refuse('freshness');
  if (m.parsed.status === 'ambiguous') return refuse('ambiguity');
  if (
    m.parsed.status !== 'candidate' ||
    !/^[A-Za-z0-9]{4,8}$/.test(m.parsed.candidate.code) ||
    (r.expectedLength !== 0 &&
      m.parsed.candidate.code.length !== r.expectedLength)
  )
    return refuse('code');
  return { state: 'CANDIDATE' };
}

/** Recipient matching is a local hint. Gmail dot/plus aliases describe the same
 * personal mailbox; other providers retain their literal local-part spelling. */
export function recipientMatches(a: string, b: string): boolean {
  const canonical = (address: string) => {
    const [local, domain] = address.toLowerCase().split('@');
    return ['gmail.com', 'googlemail.com'].includes(domain ?? '')
      ? local!.split('+')[0]!.replace(/\./g, '') + '@gmail.com'
      : address.toLowerCase();
  };
  return canonical(a) === canonical(b);
}

/** Matching hints, never sender trust. A different brand is excluded only when
 * another candidate actually matches the destination; generic/provider mail stays
 * unknown and therefore cannot silently disappear from an ambiguous set. */
export function genericServiceHint(
  origin: string,
  senderDomain: string | undefined,
  subject: string,
): 'match' | 'different' | 'unknown' {
  if (!senderDomain || !/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(senderDomain))
    return 'unknown';
  if (!normalizeOrigin(origin)) return 'unknown';
  const host = new URL(origin).hostname.toLowerCase();
  const sender = senderDomain.toLowerCase();
  if (host === sender || host.endsWith('.' + sender)) return 'match';
  const labels = sender.split('.');
  const pattern =
    /\b([a-z][a-z0-9-]{2,40})\s+(?:(?:verification|security|login|sign-in|authentication)\s+)?code\b|\bcode\s+(?:for|from)\s+([a-z][a-z0-9-]{2,40})\b/gi;
  const generic = new Set([
    'your',
    'the',
    'this',
    'verification',
    'security',
    'login',
    'authentication',
    'confirmation',
    'one-time',
    'access',
    'email',
    'sign-in',
    'enter',
    'use',
    'a',
  ]);
  for (const match of subject.matchAll(pattern)) {
    const brand = (match[1] ?? match[2])!.toLowerCase();
    if (
      generic.has(brand) ||
      brand === labels.at(-1) ||
      !labels.includes(brand)
    )
      continue;
    return host.split('.').includes(brand) ? 'match' : 'different';
  }
  return 'unknown';
}
