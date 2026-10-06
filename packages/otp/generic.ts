import type { NormalizedEmail, ParseResult, CodeCandidate } from './index';

/** Candidate extraction only; neither sender identity nor destination is verified. */
export function parseGenericCode(email: NormalizedEmail): ParseResult {
  if (email.subject.length > 1000 || email.text.length > 32768)
    return { status: 'rejected', reason: 'input-limit' };
  const text = `${email.subject}\n${email.text}`
    .replace(/\r\n?/g, '\n')
    // Inert markup can put the footer on the same line as a code label. An
    // explicitly marked copyright year is metadata, not another OTP. Do not
    // discard arbitrary four-digit values: 2026 can itself be a valid code.
    .replace(
      /((?:©|\bcopyright\b)\s*(?:\(c\)\s*)?)[12][0-9]{3}(?:\s*[-–—]\s*[12][0-9]{3})?(?![0-9])/gi,
      '$1 ',
    );
  if (
    /(^|\n)\s*(>|on .+wrote:|[- ]*(?:original|forwarded) message|begin forwarded message:|from:)/i.test(
      text,
    )
  )
    return { status: 'rejected', reason: 'quoted-or-forwarded' };
  const lines = codeStatements(text);
  if (
    /\b(recovery|backup|payment|purchase|order|transaction|transfer|withdrawal|discount|coupon|promo|gift|sms|authenticator|totp|delete|deletion|reset)\b/i.test(
      lines.join('\n'),
    )
  )
    return { status: 'rejected', reason: 'unsupported-purpose' };
  const label =
    /\b(?:(?:verification|security|confirmation|authentication|login|sign[ -]?in|one[ -]?time|access) (?:code|password)|(?:your|the|this) code|passcode|otp)\b(?!\s+(?:(?:was|has been|had been|is)\s+)?requested\s+(?:from|at|on|by|using)\b)/i;
  if (!label.test(text))
    return { status: 'rejected', reason: 'unsupported-template' };
  // Digit cells can be separated by block/table markup in inert HTML text.
  for (let i = 0; i < lines.length; i++) {
    if (
      !/^[A-Za-z0-9]$/.test(lines[i]!) ||
      !label.test(previousContext(lines, i))
    )
      continue;
    let end = i;
    while (end < lines.length && /^[A-Za-z0-9]$/.test(lines[end]!)) end++;
    if (end - i >= 4 && end - i <= 8)
      lines.splice(i, end - i, lines.slice(i, end).join(''));
    else i = end - 1;
  }
  const numbers = [
    ...new Set(
      lines.flatMap((line, i) => {
        const matchedLabel = label.exec(line);
        const labeled = matchedLabel !== null;
        const nearby = label.test(previousContext(lines, i));
        const standalone =
          /^(?:[A-Za-z0-9]{4,8}|[A-Za-z0-9]{3}-[A-Za-z0-9]{3})$/.test(line);
        const instruction =
          /\b(?:enter|use|type)\b.*\b(?:code|sign[ -]?in|log[ -]?in|verify)\b/i.test(
            line,
          );
        if (!labeled && !(standalone && nearby) && !instruction) return [];
        if (matchedLabel) {
          const after = line.slice(matchedLabel.index + matchedLabel[0].length);
          const before = line.slice(0, matchedLabel.index);
          const preceding =
            /(?<![\p{L}\p{N}_/@.-])([0-9]{4,8})\s*(?:is|:|-)?\s*(?:(?:your|the)\s*)?$/iu.exec(
              before,
            );
          const letterCodes = [
            ...line.matchAll(new RegExp(label.source, 'gi')),
          ].flatMap((match) =>
            lettersIn(line.slice(match.index + match[0].length)),
          );
          return [
            ...numbersIn(after),
            ...letterCodes,
            ...(preceding ? [preceding[1]!] : []),
            ...lettersBefore(before),
          ];
        }
        return [
          ...numbersIn(line),
          ...(standalone && nearby && /[A-Za-z]/.test(line)
            ? [line.replace('-', '')]
            : []),
        ];
      }),
    ),
  ];
  const candidates: CodeCandidate[] = numbers.map((code) => ({
    code,
    purpose: 'sign-in',
    template: 'inline',
    score: 0,
    signals: ['explicit-code-label', 'supported-purpose'],
  }));
  if (candidates.length > 1) return { status: 'ambiguous', candidates };
  if (candidates.length !== 1)
    return { status: 'rejected', reason: 'unsupported-template' };
  return { status: 'candidate', candidate: candidates[0]! };
}

// Metadata is a context boundary, not a blanket instruction to discard a line:
// a separate explicit code label later in that line must still participate.
const metadata =
  /\b(?:(?:your|the|this) code\s+(?:(?:was|has been|had been|is)\s+)?requested\s+(?:from|at|on|by|using)|(?:request|case|ticket)\s+(?:reference|id|number)\s*[:#]|reference\s*[:#])/i;

function codeStatements(text: string): string[] {
  return text
    .replace(new RegExp(metadata.source, 'gi'), '\n$&')
    .split(/\n|(?=\bwe\s+(?:will\s+)?never\s+(?:ask|request)\b)/i)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      // Only a clearly negated safety statement without numbers or code wording is ignorable. A
      // disclaimer containing another number or code stays in conservative checks.
      return !(
        /^we\s+(?:will\s+)?never\s+(?:ask|request)\b/i.test(line) &&
        !/[0-9]/.test(line) &&
        !/\b(?:code|otp|passcode)\b/i.test(line)
      );
    });
}

function previousContext(lines: readonly string[], index: number): string {
  const context: string[] = [];
  for (let i = index - 1; i >= Math.max(0, index - 2); i--) {
    if (metadata.test(lines[i]!)) break;
    context.unshift(lines[i]!);
  }
  return context.join(' ');
}

/** Grouped digits are accepted only as a complete 4–8 digit numeric run. */
function numbersIn(text: string): string[] {
  const grouped = [
    ...text.matchAll(
      /(?<![\p{L}\p{N}_/@.-])([0-9]{3})-([0-9]{3})(?![\p{L}\p{N}_/@-])(?!(?:\.[\p{L}\p{N}]))/giu,
    ),
  ].map((match) => match[1]! + match[2]!);
  return [
    ...grouped,
    ...(
      text.match(
        /(?<![\p{L}\p{N}_/@.-])[0-9]+(?:[ \t\u00a0]+[0-9]+)*(?![\p{L}\p{N}_/@-])(?!(?:\.[\p{L}\p{N}]))/giu,
      ) ?? []
    ).flatMap((run) => {
      const compact = run.replace(/[ \t\u00a0]/g, '');
      if (/^[0-9]{4,8}$/.test(compact)) return [compact];
      return (
        run.match(
          /(?<![\p{L}\p{N}_/@.-])[0-9]{4,8}(?![\p{L}\p{N}_/@-])(?!(?:\.[\p{L}\p{N}]))/giu,
        ) ?? []
      );
    }),
  ];
}

// Unquoted introductory/status words are prose rather than evidence of a code.
const proseWord =
  /^(?:here|this|that|below|above|attached|included|enclosed|provided|valid|invalid|expired|expires|pending|missing|sent|ready|unknown)$/i;

/** Letters need exact code placement; do not scan arbitrary prose for words. */
function lettersIn(text: string): string[] {
  const positioned =
    /^\s*(?:(?:is|when prompted|to sign[ -]?in|to log[ -]?in|to verify (?:your )?email)\b\s*)?[:=]?\s*(["'`]?)([A-Za-z0-9]{3}-[A-Za-z0-9]{3}|[A-Za-z0-9]{4,8})\1(?=$|[.,;](?:\s|$)|\s+(?:or|and|expires)\b)/i.exec(
      text,
    );
  if (!positioned) return [];
  const codes =
    /[A-Za-z]/.test(positioned[2]!) &&
    (positioned[1] !== '' || !proseWord.test(positioned[2]!))
      ? [positioned[2]!.replace('-', '')]
      : [];
  const remainder = text.slice(positioned[0].length);
  for (const match of remainder.matchAll(
    /\b(?:or|and)\s+(["'`]?)([A-Za-z0-9]{3}-[A-Za-z0-9]{3}|[A-Za-z0-9]{4,8})\1(?=$|[.,;](?:\s|$)|\s+(?:or|and|expires)\b)/gi,
  ))
    if (
      /[A-Za-z]/.test(match[2]!) &&
      (match[1] !== '' || !proseWord.test(match[2]!))
    )
      codes.push(match[2]!.replace('-', ''));
  return codes;
}

function lettersBefore(text: string): string[] {
  const match =
    /^\s*([A-Za-z0-9]{3}-[A-Za-z0-9]{3}|[A-Za-z0-9]{4,8})\s+is\s+(?:(?:your|the)\s*)?$/i.exec(
      text,
    );
  return match && /[A-Za-z]/.test(match[1]!) && !proseWord.test(match[1]!)
    ? [match[1]!.replace('-', '')]
    : [];
}
