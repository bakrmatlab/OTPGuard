import { expect, it } from 'vitest';
import { normalizeGmailMessage, parseVerificationCode } from '../packages/otp';
import {
  assessGmailSender,
  authorize,
  supportedServices,
  type ServicePolicy,
} from '../packages/security';
import { syntheticGmail } from './fixtures/email/gmail';

const policy: ServicePolicy = {
  id: 'synthetic-lantern',
  name: 'Synthetic Lantern',
  origins: ['https://login.lantern.example'],
  senders: [
    {
      address: 'codes@mailer.example',
      authenticatedDomain: 'mailer.example',
      boundaryId: 'mx.google.com',
      method: 'aligned-dmarc',
    },
  ],
  templates: ['inline'],
  purposes: ['sign-in'],
  codeLengths: [6],
  maxAgeMs: 300_000,
  provenance: 'Fabricated test policy, no real service validation',
  validatedOn: '2026-10-03',
};
it.each(
  [
    [],
    [
      {
        name: 'Authentication-Results',
        value:
          'mx.google.com; dkim=pass header.d=mailer.example; dmarc=pass header.from=mailer.example; spf=pass smtp.mailfrom=mailer.example',
      },
    ],
    [
      {
        name: 'Authentication-Results',
        value:
          'mx.google.com; dkim=pass header.d=attacker.example; spf=pass smtp.mailfrom=attacker.example',
      },
    ],
    [
      {
        name: 'Authentication-Results',
        value: 'mx.google.com; dmarc=pass header.from=mailer.example',
      },
      {
        name: 'authentication-results',
        value: 'mx.google.com; dmarc=fail header.from=mailer.example',
      },
    ],
    [
      {
        name: 'Authentication-Results',
        value: 'mx.google.com; dmarc=fail header.from=mailer.example',
      },
      {
        name: 'Authentication-Results',
        value: 'mx.google.com; dmarc=pass header.from=mailer.example',
      },
    ],
    [
      { name: 'Received', value: 'from forged by mx.google.com' },
      {
        name: 'ARC-Authentication-Results',
        value: 'i=1; mx.google.com; dkim=pass header.d=mailer.example',
      },
      { name: 'ARC-Seal', value: 'i=1; cv=pass; d=google.com; b=synthetic' },
    ],
    [
      { name: 'Received-SPF', value: 'pass (google.com: mailer.example)' },
      { name: 'DKIM-Signature', value: 'v=1; d=mailer.example; b=synthetic' },
    ],
    [
      {
        name: 'Authentication-Results',
        value:
          '(forged comment) mx.google.com;\r\n dmarc=pass header.from=mailer.example',
      },
    ],
  ].map((headers) => ({ headers })),
)(
  'never authenticates plausible, forged, reordered or duplicate header claims %#',
  ({ headers }) => {
    const input = syntheticGmail();
    input.payload.headers.unshift(...headers);
    const result = normalizeGmailMessage(input);
    expect(result.status).toBe('normalized');
    if (result.status !== 'normalized')
      throw new Error('Synthetic fixture rejected');
    const assessment = assessGmailSender(result.message);
    expect(assessment).toEqual({
      sender: { status: 'unknown' },
      reason: 'receiver-provenance-unverified',
      receipt: { status: 'unverified', internalDate: 995000 },
    });
    expect(JSON.stringify(assessment)).not.toContain('003719');
    // Even a permissive synthetic registry and perfect remaining request gates cannot
    // elevate these claims. The production registry remains empty independently.
    expect(
      authorize(
        {
          serviceId: policy.id,
          now: 1000000,
          locallyBlocked: false,
          request: {
            mailboxId: 'synthetic-mailbox',
            startedAt: 990000,
            deadline: 1050000,
            url: policy.origins[0]!,
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
              messageId: result.message.messageId,
              mailboxId: 'synthetic-mailbox',
              receivedAt: 995000,
              sender: assessment.sender,
              parsed: parseVerificationCode(result.message.email),
            },
          ],
        },
        [policy],
      ),
    ).toEqual({ state: 'UNKNOWN', reason: 'sender' });
  },
);
it.each([
  'Trusted Service <evil@attacker.example>',
  'codes@mailer.example',
  '"codes@mailer.example" <evil@attacker.example>',
])('does not trust From or display name %s', (value) => {
  const input = syntheticGmail();
  input.payload.headers[1]!.value = value;
  input.payload.headers.push({ name: 'From', value: 'codes@mailer.example' });
  const result = normalizeGmailMessage(input);
  if (result.status !== 'normalized')
    throw new Error('Synthetic fixture rejected');
  expect(assessGmailSender(result.message).sender.status).toBe('unknown');
});
it('does not treat inserted/imported mail with fresh timestamps and copied headers as direct SMTP', () => {
  const input = syntheticGmail();
  input.internalDate = '1000000';
  input.payload.headers.push({
    name: 'Authentication-Results',
    value: 'mx.google.com; dmarc=pass header.from=mailer.example',
  });
  // Gmail full Message has no documented origin discriminator; forged imported
  // representation is indistinguishable here. Date/internalDate cannot resolve it.
  const result = normalizeGmailMessage(input);
  if (result.status !== 'normalized')
    throw new Error('Synthetic fixture rejected');
  expect(assessGmailSender(result.message).receipt.status).toBe('unverified');
  expect(assessGmailSender(result.message).sender.status).toBe('unknown');
  expect(
    supportedServices.every(
      (s) => s.evidenceContract === 'signed-content-pilot',
    ),
  ).toBe(true);
});
