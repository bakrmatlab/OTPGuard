import { expect, it } from 'vitest';
import { parseGenericCode, normalizeRawEmail } from '../packages/otp';
import { parseWorker } from '../apps/extension/pipeline/protocol';

function exact(subject: string, text: string, code: string) {
  const parsed = parseGenericCode({ subject, text });
  if (parsed.status !== 'candidate' || parsed.candidate.code !== code)
    throw new Error(
      JSON.stringify({ subject, text, expected: code, actual: parsed }),
    );
  if (
    !parseWorker({
      type: 'release',
      requestId: 'matrix',
      groupId: 'fields-1',
      expectedLength: code.length,
      expiresAt: 2000,
      code,
    })
  )
    throw new Error('Production release schema refused supported matrix code');
}
function* classes(length: number, prefix = ''): Generator<string> {
  if (!length) {
    yield prefix;
    return;
  }
  for (const char of ['A', 'a', '0']) yield* classes(length - 1, prefix + char);
}
it('covers all 9,801 upper/lower/digit position combinations across supported lengths and three placements', () => {
  let count = 0;
  for (let length = 4; length <= 8; length++)
    for (const code of classes(length)) {
      exact('Sign in', `Your verification code is ${code}.`, code);
      exact(
        `Confirmation code: ${code}`,
        'Enter this code in your browser.',
        code,
      );
      exact('Sign in', `Your login code:\n${code}`, code);
      count++;
    }
  expect(count).toBe(9801);
});
const labels = [
  'verification code',
  'security code',
  'confirmation code',
  'authentication code',
  'login code',
  'sign-in code',
  'one-time password',
  'access code',
  'passcode',
  'OTP',
];
it.each(labels)('covers upper/lower wording and separators for %s', (label) => {
  for (const wording of [label.toLowerCase(), label.toUpperCase()])
    for (const separator of [
      ': ',
      ' is ',
      ' IS ',
      ' is: ',
      ' = ',
      '\n',
      '\r\n',
    ])
      for (const code of ['003719', 'A7b9Q2', 'ABCDEF', 'abcdef'])
        exact('Sign in', `Your ${wording}${separator}${code}`, code);
});
it('covers each ASCII alphanumeric character in every position at each supported length', () => {
  const alphabet =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  for (let length = 4; length <= 8; length++)
    for (let position = 0; position < length; position++)
      for (const char of alphabet) {
        const original = 'Q7n2X8b9'.slice(0, length);
        const code =
          original.slice(0, position) + char + original.slice(position + 1);
        exact('Verification code', `Your code: ${code}`, code);
      }
});
it('covers all 729 grouped upper/lower/digit position combinations and canonical duplicates', () => {
  let count = 0;
  for (const code of classes(6)) {
    const grouped = code.slice(0, 3) + '-' + code.slice(3);
    exact(`Confirmation code: ${grouped}`, `Your code: ${code}`, code);
    exact('Confirmation code', `Your code is ${grouped}.`, code);
    exact('Confirmation code', `Your code:\n${grouped}`, code);
    count++;
  }
  expect(count).toBe(729);
});
it.each([
  'Here',
  'This',
  'That',
  'Below',
  'Attached',
  'Included',
  'ABOVE',
  'PROVIDED',
  'ENCLOSED',
])('does not select introductory prose: %s', (word) => {
  expect(
    parseGenericCode({
      subject: 'Verification code',
      text: `${word} is your verification code. Enter it in your browser.`,
    }).status,
  ).not.toBe('candidate');
});
it.each(['A7b9Q2', 'ABCDEF', '003719'])(
  'preserves %s through MIME containers, transfers and inert layouts',
  (code) => {
    const bodies = [
      `Your code: ${code}`,
      `<p>Your code:</p><b>${code}</b>`,
      `<p>Your code:</p><table><tr>${[...code].map((char) => `<td>${char}</td>`).join('')}</tr></table>`,
    ];
    for (const [index, body] of bodies.entries())
      for (const transfer of ['7bit', 'base64']) {
        const encoded = transfer === 'base64' ? btoa(body) : body;
        const raw = new TextEncoder().encode(
          `Subject: Verification code\r\nContent-Type: ${index ? 'text/html' : 'text/plain'}; charset=utf-8\r\nContent-Transfer-Encoding: ${transfer}\r\n\r\n${encoded}`,
        );
        const normalized = normalizeRawEmail(raw, true);
        expect(normalized).not.toBeNull();
        exact(normalized!.subject, normalized!.text, code);
      }
  },
);
it('does not hide alternatives, malformed tokens or unsupported purposes across format families', () => {
  for (const code of ['003719', 'ABCDEF', 'a7B9q2', 'ABC-DEF']) {
    for (const purpose of [
      'payment',
      'password reset',
      'recovery',
      'backup',
      'authenticator',
      'SMS',
    ])
      expect(
        parseGenericCode({
          subject: 'Verification code',
          text: `Your ${purpose} code: ${code}`,
        }).status,
      ).not.toBe('candidate');
    for (const competing of ['009817', 'ZYXWVU', 'z8Y7x6', 'ZYX-WVU'])
      expect(
        parseGenericCode({
          subject: `Your code: ${code}`,
          text: `Your code: ${competing}`,
        }).status,
      ).toBe('ambiguous');
    expect(
      parseGenericCode({ subject: 'Your code', text: `> Your code: ${code}` })
        .status,
    ).not.toBe('candidate');
  }
  for (const token of [
    'ABC_DEF',
    'ABC--DEF',
    'ABCD-1234',
    'ABC-DEF-GHI',
    'ABCDEF.example',
    'ABCDEFGHI',
    '１２３４５６',
    'ABC/DEF',
  ])
    expect(
      parseGenericCode({
        subject: 'Verification code',
        text: `Your code: ${token}`,
      }).status,
    ).not.toBe('candidate');
});

it('covers quoted codes and normal expiry instructions without extracting words', () => {
  for (const code of ['003719', 'A7b9Q2', 'ABCDEF', 'abcdef']) {
    for (const quote of ['"', "'", '`'])
      exact('Verification code', `Your code is ${quote}${code}${quote}.`, code);
    exact(
      'Verification code',
      `Your code is ${code} expires in 10 minutes.`,
      code,
    );
    expect(
      parseGenericCode({
        subject: 'Verification code',
        text: 'Your code is valid for five minutes.',
      }).status,
    ).not.toBe('candidate');
  }
});
it('does not release a prefix or suffix from overlong or punctuated tokens', () => {
  for (let length = 4; length <= 8; length++)
    for (const code of [
      'A'.repeat(length),
      '0'.repeat(length),
      'a'.repeat(length),
    ]) {
      for (const token of [
        '_' + code,
        code + '_',
        code + '/bad',
        'https://' + code + '.example',
        code + '@example.invalid',
        code + '.example',
        'é' + code,
        code + '.1234',
      ])
        expect(
          parseGenericCode({
            subject: 'Verification code',
            text: `Your code: ${token}`,
          }).status,
          token,
        ).not.toBe('candidate');
    }
});
it('does not turn code-status sentences into letter-only candidates', () => {
  for (const word of [
    'valid',
    'invalid',
    'expired',
    'pending',
    'missing',
    'sent',
    'ready',
    'unknown',
  ])
    for (const token of [
      word,
      word.toUpperCase(),
      word[0]!.toUpperCase() + word.slice(1),
    ])
      expect(
        parseGenericCode({
          subject: 'Verification code',
          text: `Your code is ${token}.`,
        }).status,
        token,
      ).not.toBe('candidate');
});
it('covers every numeric space-group partition and common whitespace separator', () => {
  for (let length = 4; length <= 8; length++)
    for (let mask = 1; mask < 2 ** (length - 1); mask++)
      for (const separator of [' ', '\t', '\u00a0']) {
        const code = '00371928'.slice(0, length);
        const displayed = [...code]
          .map(
            (char, index) =>
              char +
              (index < length - 1 && mask & (1 << index) ? separator : ''),
          )
          .join('');
        exact('Verification code', `Your code: ${displayed}`, code);
      }
});

it('retains explicit quoted or isolated alphabetic values even when they are ordinary words', () => {
  exact('Verification code', 'Your code: "VALID".', 'VALID');
  exact('Verification code', 'Your code:\nVALID', 'VALID');
});
