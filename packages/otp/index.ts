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

export { normalizeRawEmail } from './raw';

export { parseGenericCode } from './generic';
