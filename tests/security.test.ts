import { describe, expect, it } from 'vitest';
import {
  authorize,
  normalizeOrigin,
  type AuthorizationInput,
  type ServicePolicy,
} from '../packages/security';
import { parseVerificationCode } from '../packages/otp';
const policy: ServicePolicy = {
  id: 'synthetic-lantern',
  name: 'Synthetic Lantern',
  origins: ['https://login.lantern.example'],
  senders: [
    {
      address: 'codes@mailer.example',
      authenticatedDomain: 'mailer.example',
      boundaryId: 'synthetic-receiver-v1',
      method: 'aligned-dkim',
    },
  ],
  templates: ['inline'],
  purposes: ['sign-in'],
  codeLengths: [6],
  maxAgeMs: 300_000,
  provenance: 'Synthetic fixtures only; no real sender attestation',
  validatedOn: '2026-10-03',
};
function fixture(): AuthorizationInput {
  return {
    serviceId: policy.id,
    now: 1_000_000,
    locallyBlocked: false,
    request: {
      mailboxId: 'synthetic-mailbox',
      startedAt: 990_000,
      deadline: 1_050_000,
      url: 'https://login.lantern.example/challenge?service=untrusted',
      topLevel: true,
      current: true,
      foreground: true,
      emailFlow: true,
      purpose: 'sign-in',
      expectedLength: 6,
      competingChallenges: 0,
    },
    messages: [
      {
        messageId: 'synthetic-message',
        mailboxId: 'synthetic-mailbox',
        receivedAt: 995_000,
        sender: {
          status: 'authenticated',
          messageId: 'synthetic-message',
          mailboxId: 'synthetic-mailbox',
          address: 'codes@mailer.example',
          authenticatedDomain: 'mailer.example',
          boundaryId: 'synthetic-receiver-v1',
          method: 'aligned-dkim',
          delivery: 'direct',
        },
        parsed: parseVerificationCode({
          subject: 'Sign in to Synthetic Lantern',
          text: 'Login code: 003719',
        }),
      },
    ],
  };
}
const decide = (input: AuthorizationInput) => authorize(input, [policy]);
describe('pure authorization', () => {
  it('requires all evidence and returns no code', () => {
    expect(decide(fixture())).toEqual({
      state: 'VERIFIED',
      serviceId: policy.id,
    });
    expect(authorize(fixture())).toEqual({
      state: 'UNKNOWN',
      reason: 'unsupported-service',
    });
  });
  it.each([
    'https://lantern.example',
    'https://evil.login.lantern.example',
    'https://login.lantern.example.evil.test',
    'https://login.lantern.example:444',
    'http://login.lantern.example',
    'https://login.lantern.example.',
    'https://login.lаntern.example',
    'https://user@login.lantern.example',
    'not a URL',
  ])('rejects destination %s despite high scores and claims', (url) => {
    const input = fixture();
    input.request.url = url;
    expect(decide(input)).toEqual({ state: 'MISMATCH', reason: 'destination' });
  });
  it('canonicalizes case, default port and IDNA without suffix matching', () => {
    const input = fixture();
    input.request.url = 'https://LOGIN.LANTERN.EXAMPLE:443/path';
    expect(decide(input).state).toBe('VERIFIED');
    expect(normalizeOrigin('https://bücher.example')).toBe(
      'https://xn--bcher-kva.example',
    );
  });
  it('local blocks precede all evidence', () => {
    const input = fixture();
    input.locallyBlocked = true;
    input.serviceId = 'unsupported';
    expect(decide(input)).toEqual({ state: 'BLOCKED', reason: 'local-block' });
  });
  it.each(['unknown', 'failed'] as const)(
    'does not trust %s sender evidence',
    (status) => {
      const input = fixture();
      input.messages[0]!.sender = { status };
      expect(decide(input)).toEqual({ state: 'UNKNOWN', reason: 'sender' });
    },
  );
  it.each(['address', 'authenticatedDomain', 'boundaryId', 'method'] as const)(
    'requires exact sender %s relationship',
    (field) => {
      const input = fixture();
      const sender = input.messages[0]!.sender;
      if (sender.status === 'authenticated') {
        if (field === 'method') sender.method = 'aligned-dmarc';
        else sender[field] = 'forged.example';
      }
      expect(decide(input)).toEqual({ state: 'MISMATCH', reason: 'sender' });
    },
  );
  it.each([
    ['topLevel', false],
    ['current', false],
    ['foreground', false],
    ['emailFlow', false],
    ['deadline', 1_000_000],
    ['startedAt', 1_000_001],
    ['deadline', 1_060_001],
  ] as const)('rejects request %s=%s', (key, value) => {
    const input = fixture();
    Object.assign(input.request, { [key]: value });
    expect(decide(input)).toEqual({ state: 'UNKNOWN', reason: 'request' });
  });
  it.each([0, 929_999, 1_000_001, NaN])(
    'rejects stale/future/invalid receipt %s',
    (receivedAt) => {
      const input = fixture();
      input.messages[0]!.receivedAt = receivedAt;
      expect(decide(input)).toEqual({ state: 'UNKNOWN', reason: 'freshness' });
    },
  );
  it('honors stricter service freshness', () => {
    expect(authorize(fixture(), [{ ...policy, maxAgeMs: 1000 }]).state).toBe(
      'UNKNOWN',
    );
  });
  it.each([null, 1, -1, NaN])(
    'rejects unknown/competing challenge count %s',
    (competingChallenges) => {
      const input = fixture();
      input.request.competingChallenges = competingChallenges;
      expect(decide(input)).toEqual({ state: 'UNKNOWN', reason: 'ambiguity' });
    },
  );
  it('refuses newest selection and duplicate plausible messages', () => {
    const input = fixture();
    input.messages = [...input.messages, ...input.messages];
    expect(decide(input)).toEqual({ state: 'UNKNOWN', reason: 'ambiguity' });
    input.messages = [];
    expect(decide(input).state).toBe('UNKNOWN');
  });
  it('binds sender evidence and receipt to message and mailbox', () => {
    const input = fixture();
    input.messages[0]!.mailboxId = 'other';
    expect(decide(input).state).toBe('UNKNOWN');
    const other = fixture();
    const sender = other.messages[0]!.sender;
    if (sender.status === 'authenticated') sender.messageId = 'other';
    expect(decide(other)).toEqual({
      state: 'UNKNOWN',
      reason: 'message-binding',
    });
  });
  it('retains parser ambiguity and rejection instead of selecting a scored code', () => {
    for (const text of [
      'Login code: 003719\nLogin code: 008417',
      'Order number: 003719',
    ]) {
      const input = fixture();
      input.messages[0]!.parsed = parseVerificationCode({
        subject: 'Sign in',
        text,
      });
      expect(decide(input).state).toBe('UNKNOWN');
    }
  });
  it('checks format, length, purpose and template independently of score', () => {
    for (const change of [
      { code: '12345' },
      { code: 'abcdef' },
      { purpose: 'email-verification' as const },
      { template: 'next-line' as const },
    ]) {
      const input = fixture();
      const parsed = input.messages[0]!.parsed;
      if (parsed.status === 'candidate')
        Object.assign(parsed.candidate, change, { score: 100 });
      expect(decide(input)).toEqual({ state: 'UNKNOWN', reason: 'code' });
    }
  });
});

describe('policy limits and registry boundaries', () => {
  it('accepts the exact lookback edge and rejects one millisecond earlier', () => {
    const input = fixture();
    input.messages[0]!.receivedAt = input.request.startedAt - 60_000;
    expect(decide(input).state).toBe('VERIFIED');
    input.messages[0]!.receivedAt--;
    expect(decide(input)).toEqual({ state: 'UNKNOWN', reason: 'freshness' });
  });
  it('caps age at five minutes even if registry is more permissive', () => {
    const input = fixture();
    input.request.startedAt = input.now;
    input.messages[0]!.receivedAt = input.now - 300_001;
    expect(authorize(input, [{ ...policy, maxAgeMs: 600_000 }]).state).toBe(
      'UNKNOWN',
    );
  });
  it('rejects duplicate policies and path-bearing registry entries', () => {
    expect(authorize(fixture(), [policy, policy]).state).toBe('UNKNOWN');
    expect(
      authorize(fixture(), [
        { ...policy, origins: ['https://login.lantern.example/path'] },
      ]).state,
    ).toBe('MISMATCH');
  });
  it('rejects unsupported requested code length and purpose', () => {
    const input = fixture();
    input.request.expectedLength = 5;
    expect(decide(input).state).toBe('UNKNOWN');
    input.request.expectedLength = 6;
    input.request.purpose = 'email-verification';
    expect(decide(input).state).toBe('UNKNOWN');
  });
});
