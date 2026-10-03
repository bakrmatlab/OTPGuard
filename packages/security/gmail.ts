import type { NormalizedGmailMessage } from '@otpguard/otp';

export interface GmailSenderAssessment {
  sender: { status: 'unknown' };
  reason: 'receiver-provenance-unverified';
  receipt: { status: 'unverified'; internalDate: number };
}
/** Gmail format=full headers are claims, not a documented receiver attestation.
 * Neither header order/authserv-id, Received, ARC, SPF nor From can enable trust.
 * No opt-in flag or caller-supplied direct-delivery assertion can change this verdict.
 * Keep receipt metadata out of MessageEvidence until SMTP provenance is established.
 */
export function assessGmailSender(
  message: NormalizedGmailMessage,
): GmailSenderAssessment {
  return {
    sender: { status: 'unknown' },
    reason: 'receiver-provenance-unverified',
    receipt: {
      status: 'unverified',
      internalDate: message.receipt.internalDate,
    },
  };
}
