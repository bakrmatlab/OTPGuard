import { expect, it } from 'vitest';
import { parseGenericCode, normalizeRawEmail } from '../packages/otp';
it.each(['A7B-C9D', 'a7b-c9d', 'ABC-DEF', '123-456'])(
  'recognizes bounded 3–3 presentation %s',
  (displayed) => {
    const code = displayed.replace('-', '');
    expect(
      parseGenericCode({
        subject: `Team confirmation code: ${displayed}`,
        text: `Confirm your email address\nHere's your confirmation code. You can copy it into the open browser window or click the link below to confirm this email address.\n${displayed}\nCONFIRM AND SIGN IN`,
      }),
    ).toMatchObject({ status: 'candidate', candidate: { code } });
  },
);
it('reads inert HTML with grouped subject and body as one exact candidate', () => {
  const raw = new TextEncoder().encode(
    'Subject: Team confirmation code: A7B-C9D\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<h1>Confirm your email address</h1><p>Here is your confirmation code. Enter it in the browser.</p><div>A7B-C9D</div><a href="https://fixture.invalid/signin">Confirm and sign in</a>',
  );
  expect(parseGenericCode(normalizeRawEmail(raw, true)!)).toMatchObject({
    status: 'candidate',
    candidate: { code: 'A7BC9D' },
  });
});
it.each([
  'ABCD-1234',
  'ABC--DEF',
  'ABC_DEF',
  'ABC-DEF-GHI',
  'https://ABC-DEF.example',
])('does not remove arbitrary separators from %s', (code) => {
  expect(
    parseGenericCode({
      subject: 'Confirmation code',
      text: `Your confirmation code: ${code}`,
    }).status,
  ).not.toBe('candidate');
});
it('distinct grouped values remain ambiguous', () => {
  expect(
    parseGenericCode({
      subject: 'Confirmation code: A7B-C9D',
      text: 'Your confirmation code: Z8Y-X6W',
    }).status,
  ).toBe('ambiguous');
});
