import { expect, it } from 'vitest';
import { normalizeRawEmail, parseGenericCode } from '../packages/otp';
const raw = (headers: string[], body: string) =>
  new TextEncoder().encode(headers.join('\r\n') + '\r\n\r\n' + body);
it.each([
  [
    'repeated delivery headers',
    ['X-Received: a', 'X-Received: b', 'Content-Type: text/plain'],
    'Your code is 003719',
  ],
  [
    'boundary whitespace',
    ['Content-Type: multipart/alternative; boundary = "p"'],
    '--p\r\nContent-Type: text/plain\r\n\r\nYour code is 003719\r\n--p--\r\n',
  ],
  [
    'encoded subject alias',
    ['Subject: =?utf8?Q?Your_login_code?=', 'Content-Type: text/plain'],
    'Your code is 003719',
  ],
  [
    'large HTML styling',
    ['Content-Type: text/html; charset=utf-8'],
    '<style>' +
      'p {color: black;}\n'.repeat(3000).replace(/\n/g, '\r\n') +
      '</style><p>Your code is 003719</p>',
  ],
  [
    'unpadded base64',
    ['Content-Type: text/plain', 'Content-Transfer-Encoding: base64'],
    Buffer.from('Your code is 003719').toString('base64').replace(/=+$/, ''),
  ],
])('normalizes %s without hiding a code', (_name, headers, body) => {
  const email = normalizeRawEmail(raw(headers, body), true);
  expect(email).not.toBeNull();
  expect(parseGenericCode(email!)).toMatchObject({
    status: 'candidate',
    candidate: { code: '003719' },
  });
});
it('retains ambiguity across large rich alternatives and rejects critical duplicate headers', () => {
  const text =
    '<style>' + 'x'.repeat(40000) + '</style><p>Your code is 008417</p>';
  const email = normalizeRawEmail(
    raw(
      ['Content-Type: multipart/alternative; boundary=p'],
      '--p\r\nContent-Type: text/plain\r\n\r\nYour code is 003719\r\n--p\r\nContent-Type: text/html\r\n\r\n' +
        text +
        '\r\n--p--\r\n',
    ),
    true,
  );
  expect(email).not.toBeNull();
  expect(parseGenericCode(email!).status).toBe('ambiguous');
  expect(
    normalizeRawEmail(
      raw(
        ['Content-Type: text/plain', 'Content-Type: text/html'],
        'Your code is 003719',
      ),
      true,
    ),
  ).toBeNull();
});

it.each(['charset=utf8; charset=windows-1252', 'boundary=p; boundary=q'])(
  'refuses conflicting MIME parameters %s',
  (parameters) => {
    expect(
      normalizeRawEmail(
        raw(['Content-Type: text/plain; ' + parameters], 'Your code is 003719'),
        true,
      ),
    ).toBeNull();
  },
);

it('recognizes Gmail dot/plus aliases without equating other providers', async () => {
  const { recipientMatches } = await import('../packages/security/generic');
  expect(
    recipientMatches('per.son+login@gmail.com', 'person@googlemail.com'),
  ).toBe(true);
  expect(
    recipientMatches('per.son+login@example.com', 'person@example.com'),
  ).toBe(false);
});

it.each(['text/plain', 'text/html'])(
  'accepts well-formed UTF-8 %s with no charset declaration',
  (mime) => {
    const email = normalizeRawEmail(
      raw(
        ['Content-Type: ' + mime, 'Content-Transfer-Encoding: 8bit'],
        mime === 'text/html'
          ? '<p>Your code is 003719</p><p>© Example</p>'
          : 'Your code is 003719 © Example',
      ),
      true,
    );
    expect(email).not.toBeNull();
    expect(parseGenericCode(email!)).toMatchObject({
      status: 'candidate',
      candidate: { code: '003719' },
    });
  },
);
