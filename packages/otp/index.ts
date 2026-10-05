/** Untrusted normalized plain text only; no MIME, HTML, identity or fill authority. */
export interface NormalizedEmail {
  subject: string;
  text: string;
}
export type Purpose = 'sign-in' | 'email-verification';
export interface CodeCandidate {
  code: string;
  purpose: Purpose;
  template: 'inline' | 'next-line';
  /** Deterministic heuristic, never a probability or authorization decision. */
  score: number;
  signals: readonly ['explicit-code-label', 'supported-purpose'];
}
export type ParseResult =
  | { status: 'candidate'; candidate: CodeCandidate }
  | { status: 'ambiguous'; candidates: readonly CodeCandidate[] }
  | {
      status: 'rejected';
      reason:
        | 'input-limit'
        | 'quoted-or-forwarded'
        | 'unsupported-purpose'
        | 'unsupported-template'
        | 'unsupported-length';
    };

const label = '(?:verification|sign[ -]?in|login|one[ -]?time) code';
const inline = new RegExp(
  `^(?:your )?${label}(?: is)?\\s*:\\s*([0-9]+)[.!]?$`,
  'i',
);
const prose = new RegExp(`^(?:your )?${label} is ([0-9]+)[.!]?$`, 'i');
const heading = new RegExp(`^(?:your )?${label}(?: is)?\\s*:?$`, 'i');
const unsupported =
  /\b(reset|password|recovery|backup|payment|purchase|order|tracking|price|date|transaction|transfer|withdrawal|phone|sms|authenticator|totp|delete|deletion)\b/i;
const quoted =
  /(^|\n)\s*(>|on .+wrote:|[- ]*(?:original|forwarded) message|begin forwarded message:|from:)|["“”«»]/i;

/** Accepts only ASCII numeric lengths 4–8 in explicitly supported English templates.
 * Repeated identical codes agree; distinct values remain ambiguous.
 * Callers must retain the rejection/ambiguity state and apply independent policy.
 */
export function parseVerificationCode(email: NormalizedEmail): ParseResult {
  if (email.subject.length > 1000 || email.text.length > 32_768)
    return { status: 'rejected', reason: 'input-limit' };
  const combined = `${email.subject}\n${email.text}`.replace(/\r\n?/g, '\n');
  if (quoted.test(combined))
    return { status: 'rejected', reason: 'quoted-or-forwarded' };
  if (unsupported.test(combined))
    return { status: 'rejected', reason: 'unsupported-purpose' };
  const login = /\b(sign[ -]?in|log[ -]?in)\b/i.test(combined);
  const verify =
    /\bverify (?:your )?email(?: address)?\b|\bemail verification\b/i.test(
      combined,
    );
  if (login === verify)
    return { status: 'rejected', reason: 'unsupported-purpose' };
  const purpose: Purpose = login ? 'sign-in' : 'email-verification';
  const lines = combined
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates: CodeCandidate[] = [];
  let invalidLength = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const match = inline.exec(line) ?? prose.exec(line);
    const next = lines[index + 1];
    const code =
      match?.[1] ??
      (heading.test(line) && next && /^[0-9]+$/.test(next) ? next : undefined);
    if (!code) continue;
    if (code.length < 4 || code.length > 8) {
      invalidLength = true;
      continue;
    }
    candidates.push({
      code,
      purpose,
      template: match ? 'inline' : 'next-line',
      score: match ? 90 : 80,
      signals: ['explicit-code-label', 'supported-purpose'],
    });
    if (!match) index++;
  }
  if (invalidLength)
    return { status: 'rejected', reason: 'unsupported-length' };
  // Extra digit runs can represent another challenge or an unsupported template.
  // Do not silently resolve them by ranking or by selecting the newest/highest score.
  const numbers = combined.match(/[0-9]+/g) ?? [];
  const distinct = [...new Map(candidates.map((c) => [c.code, c])).values()];
  if (distinct.length > 1) return { status: 'ambiguous', candidates: distinct };
  const otherNumbers = numbers.filter(
    (n) => !distinct.some((c) => c.code === n),
  );
  const subjectCode = prose.exec(email.subject.trim())?.[1];
  const instructed =
    /enter this code within the next (?:[1-9]|10) minutes to log in/i.test(
      email.text,
    );
  const footerOnly =
    subjectCode && instructed && otherNumbers.every((n) => n.length < 6);
  const expiryOnly = otherNumbers.every((n) =>
    new RegExp(
      `\\b(?:within(?: the next)?|expires? in|valid for) ${n} (?:minutes?|seconds?)\\b`,
      'i',
    ).test(combined),
  );
  if (distinct.length !== 1 || !(expiryOnly || footerOnly))
    return { status: 'rejected', reason: 'unsupported-template' };
  return { status: 'candidate', candidate: distinct[0]! };
}

export { normalizeGmailMessage, gmailNormalizationLimits } from './gmail';
export type {
  GmailHeader,
  NormalizedGmailMessage,
  GmailNormalizationResult,
} from './gmail';

export { normalizeRawEmail } from './raw';

export { parseGenericCode } from './generic';
