import { expect, it } from 'vitest';
import { parseGenericCode } from '../packages/otp';
import { parseWorker } from '../apps/extension/pipeline/protocol';
it.each(['A7b9Q2', 'ABCDEF', 'abcdef', '0Ab12Z'])(
  'preserves explicitly labelled code %s',
  (code) => {
    expect(
      parseGenericCode({
        subject: 'Verification code',
        text: `Your verification code is ${code}.`,
      }),
    ).toMatchObject({ status: 'candidate', candidate: { code } });
    expect(
      parseGenericCode({
        subject: 'Verification code',
        text: `Enter your verification code:\n${code}`,
      }),
    ).toMatchObject({ status: 'candidate', candidate: { code } });
    expect(
      parseWorker({
        type: 'release',
        requestId: 'request',
        groupId: 'fields-1',
        expiresAt: 2000,
        expectedLength: 6,
        code,
      }),
    ).not.toBeNull();
  },
);
it.each([
  'Your code is valid for five minutes.',
  'Your verification code will arrive shortly.',
  'Your code: ABCDEF\nYour code: Z9y8X7',
  'Your password reset code is ABCDEF',
  'Your code is ABCDEFGHI',
])('refuses prose, ambiguity and unsupported formats: %s', (text) => {
  expect(
    parseGenericCode({ subject: 'Verification code', text }).status,
  ).not.toBe('candidate');
});
it.each(['ABCD-1234', 'ABCD.EF', 'ABCDEF.com', 'ABCD_1234'])(
  'refuses punctuation-containing token %s rather than selecting a fragment',
  (code) => {
    expect(
      parseGenericCode({
        subject: 'Verification code',
        text: `Your code is ${code}`,
      }).status,
    ).not.toBe('candidate');
  },
);
it.each([
  'ABCDEF is your verification code',
  'Use this code to sign in: A7b9Q2',
  'Your code is ABCDEF or Z9y8X7',
  'Your code is ABCDEF or 123456',
])('recognizes code placement and keeps distinct candidates: %s', (text) => {
  expect(parseGenericCode({ subject: 'Verification code', text }).status).toBe(
    text.includes(' or ') ? 'ambiguous' : 'candidate',
  );
});
it('composes separated letter/digit cells without changing case', () => {
  expect(
    parseGenericCode({
      subject: 'Verification code',
      text: 'Your code:\nA\n7\nb\n9\nQ\n2',
    }),
  ).toMatchObject({ status: 'candidate', candidate: { code: 'A7b9Q2' } });
});
it('case differences remain genuine ambiguity', () => {
  expect(
    parseGenericCode({
      subject: 'Verification code',
      text: 'Your code is ABCDEF\nYour code is abcdef',
    }).status,
  ).toBe('ambiguous');
});
it('does not hide a letter-code disclaimer containing an unsupported purpose', () => {
  expect(
    parseGenericCode({
      subject: 'Verification code',
      text: 'Your code is ABCDEF\nWe will never ask you to reset your password using code ZYXWVU.',
    }).status,
  ).not.toBe('candidate');
});

it.each(['Here', 'This', 'That'])(
  'does not read %s as a code in introductory prose',
  (word) => {
    expect(
      parseGenericCode({
        subject: 'Verification code',
        text: `${word} is your confirmation code. Enter it in the browser.`,
      }).status,
    ).not.toBe('candidate');
  },
);
