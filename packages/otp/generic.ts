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
  if (
    /\b(recovery|backup|payment|purchase|order|transaction|transfer|withdrawal|discount|coupon|promo|gift|sms|authenticator|totp|delete|deletion|reset)\b/i.test(
      text,
    )
  )
    return { status: 'rejected', reason: 'unsupported-purpose' };
  const label =
    /\b(?:(?:verification|security|confirmation|authentication|login|sign[ -]?in|one[ -]?time|access) (?:code|password)|(?:your|the|this) code|passcode|otp)\b(?!\s+(?:(?:was|has been|had been|is)\s+)?requested\s+(?:from|at|on|by|using)\b)/i;
  if (!label.test(text))
    return { status: 'rejected', reason: 'unsupported-template' };
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  // Digit cells can be separated by block/table markup in inert HTML text.
  for (let i = 0; i < lines.length; i++) {
    if (
      !/^[0-9]$/.test(lines[i]!) ||
      !label.test(lines.slice(Math.max(0, i - 2), i).join(' '))
    )
      continue;
    let end = i;
    while (end < lines.length && /^[0-9]$/.test(lines[end]!)) end++;
    if (end - i >= 4 && end - i <= 8)
      lines.splice(i, end - i, lines.slice(i, end).join(''));
    else i = end - 1;
  }
  const numbers = [
    ...new Set(
      lines.flatMap((line, i) => {
        const matchedLabel = label.exec(line);
        const labeled = matchedLabel !== null;
        const nearby = label.test(lines.slice(Math.max(0, i - 2), i).join(' '));
        const standalone = /^[0-9]{4,8}$/.test(line);
        const instruction =
          /\b(?:enter|use|type)\b.*\b(?:code|sign[ -]?in|log[ -]?in|verify)\b/i.test(
            line,
          );
        if (!labeled && !(standalone && nearby) && !instruction) return [];
        if (matchedLabel) {
          const after = line.slice(matchedLabel.index + matchedLabel[0].length);
          const before = line.slice(0, matchedLabel.index);
          const preceding =
            /(?<![a-z0-9])([0-9]{4,8})\s*(?:is|:|-)?\s*(?:(?:your|the)\s*)?$/i.exec(
              before,
            );
          return [...numbersIn(after), ...(preceding ? [preceding[1]!] : [])];
        }
        return numbersIn(line);
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

/** Grouped digits are accepted only as a complete 4–8 digit numeric run. */
function numbersIn(text: string): string[] {
  return (
    text.match(/(?<![a-z0-9])[0-9]+(?:[ \t\u00a0]+[0-9]+)*(?![a-z0-9])/gi) ?? []
  ).flatMap((run) => {
    const compact = run.replace(/[ \t\u00a0]/g, '');
    if (/^[0-9]{4,8}$/.test(compact)) return [compact];
    return run.match(/(?<![a-z0-9])[0-9]{4,8}(?![a-z0-9])/gi) ?? [];
  });
}
