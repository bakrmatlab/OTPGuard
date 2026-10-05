import { describe, expect, it } from 'vitest';
import { parseVerificationCode } from '../packages/otp';
import { syntheticEmails } from './fixtures/email/normalized';

const parse = (text: string, subject = 'Sign in to Synthetic Lantern') =>
  parseVerificationCode({ subject, text });
describe('normalized email-code parser', () => {
  it('preserves leading zeros and reports explicit heuristic evidence', () => {
    expect(parseVerificationCode(syntheticEmails.login)).toEqual({
      status: 'candidate',
      candidate: {
        code: '003719',
        purpose: 'sign-in',
        template: 'inline',
        score: 90,
        signals: ['explicit-code-label', 'supported-purpose'],
      },
    });
    expect(parseVerificationCode(syntheticEmails.verification)).toMatchObject({
      status: 'candidate',
      candidate: {
        code: '008417',
        purpose: 'email-verification',
        template: 'next-line',
        score: 80,
      },
    });
  });
  it.each([4, 5, 6, 7, 8])(
    'supports explicitly labeled length %i',
    (length) => {
      const code = '0'.repeat(length - 1) + '7';
      expect(parse(`Login code: ${code}`)).toMatchObject({
        status: 'candidate',
        candidate: { code },
      });
    },
  );
  it.each(['123', '123456789'])(
    'rejects unsupported numeric length %s',
    (code) => {
      expect(parse(`Login code: ${code}`)).toEqual({
        status: 'rejected',
        reason: 'unsupported-length',
      });
    },
  );
  it.each([
    'Order number: 003719',
    'Date: 2026-10-03',
    'Phone: 555-123-4567',
    'Price: $1234.56',
    'Tracking: 003719',
    'Verification code is 2026-10-03',
    'Verification code is 1234.56',
    'Verification code is 5551234567',
    'Verification code is 003719\nOrder: 841723',
    'Verification code is AB3719',
    'Code: 003719',
    'Your code for login is 003719',
  ])(
    'does not mistake unrelated/unsupported text for a candidate: %s',
    (text) => {
      expect(parse(text).status).toBe('rejected');
    },
  );
  it.each([
    'Password reset',
    'Recovery',
    'Payment',
    'Verify phone',
    'Authenticator',
    'Account deletion',
    'Sign in order confirmation',
    'Sign in tracking update',
    'Sign in price alert',
    'Sign in date reminder',
  ])('rejects unsupported purpose %s', (subject) => {
    expect(parse('Verification code: 003719', subject)).toEqual({
      status: 'rejected',
      reason: 'unsupported-purpose',
    });
  });
  it('rejects absent and conflicting purposes', () => {
    expect(parse('Verification code: 003719', 'Your code').status).toBe(
      'rejected',
    );
    expect(parse('Verify your email\nLogin code: 003719').status).toBe(
      'rejected',
    );
  });
  it.each([
    '> Login code: 003719',
    'On Tuesday someone wrote:\nLogin code: 003719',
    '--- Forwarded message ---\nLogin code: 003719',
    'From: someone@example.invalid\nLogin code: 003719',
    'Login code: "003719"',
  ])('rejects quoted or forwarded material', (text) => {
    expect(parse(text)).toEqual({
      status: 'rejected',
      reason: 'quoted-or-forwarded',
    });
  });
  it.each(['008417'])('retains distinct ambiguity', (second) => {
    const result = parse(`Verification code: 003719\nLogin code:\n${second}`);
    expect(result).toMatchObject({
      status: 'ambiguous',
      candidates: [
        { code: '003719', score: 90 },
        { code: second, score: 80 },
      ],
    });
  });
  it('accepts agreeing repeated labels and bounded expiry numbers', () => {
    expect(
      parse(
        'Verification code: 003719\nLogin code: 003719\nExpires in 10 minutes',
      ),
    ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
  });
  it('fails closed on bounds without truncating into a valid candidate', () => {
    expect(parse('Verification code: 003719\n' + 'x'.repeat(32768))).toEqual({
      status: 'rejected',
      reason: 'input-limit',
    });
    expect(parse('Login code: 003719', 'x'.repeat(1001))).toEqual({
      status: 'rejected',
      reason: 'input-limit',
    });
  });
  it('handles normalized CRLF/whitespace deterministically without changing input', () => {
    const email = {
      subject: 'Sign in',
      text: '  Verification code:\r\n 003719  ',
    };
    const before = { ...email };
    expect(parseVerificationCode(email)).toEqual(parseVerificationCode(email));
    expect(parseVerificationCode(email)).toMatchObject({
      status: 'candidate',
      candidate: { code: '003719' },
    });
    expect(email).toEqual(before);
  });
});
