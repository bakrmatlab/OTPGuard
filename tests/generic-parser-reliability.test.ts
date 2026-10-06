import { afterEach, expect, it, vi } from 'vitest';
import { parseGenericCode, normalizeRawEmail } from '../packages/otp';
import { createAccountGate } from '../apps/extension/account/gate';
import { createGmailLifecycle } from '../apps/extension/gmail/lifecycle';
import { GMAIL_SCOPE } from '../apps/extension/gmail/config';
import { createGmailTransport } from '../apps/extension/gmail/transport';
import { createGmailPageCoordinator } from '../apps/extension/gmail/retrieval';

const cases = [
  [
    'inline safety disclaimer',
    'Your verification code is 003719. We will never ask you to reset your password by email.',
  ],
  [
    'flattened audit',
    'Enter the following verification code when prompted: 003719. This code was requested from 192.0.2.10 at 05 October 2026, 17:15 UTC.',
  ],
  [
    'safety disclaimer',
    'Your verification code is 003719\nWe will never ask you to reset your password by email.',
  ],
  [
    'request reference',
    'Your verification code is 003719. Request reference: 123456.',
  ],
  [
    'adjacent reference',
    'Your verification code is 003719 Request reference: 123456',
  ],
  [
    'reference on next line',
    'Your verification code is 003719\nRequest reference:\n123456',
  ],
] as const;
afterEach(() => vi.useRealTimers());
it.each(cases)('selects the code despite %s', (_name, text) => {
  expect(
    parseGenericCode({ subject: 'Verification code', text }),
  ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
  expect(
    parseGenericCode({
      subject: 'Verification code',
      text: text + '\nYour verification code is 008417',
    }).status,
  ).toBe('ambiguous');
});
it.each([
  'Your code is 003719 or 008417',
  'Your code is 003719. Or 008417.',
  'Your code is 003719\nWe will never ask you to reset your password using code 008417.',
  'Your password reset code is 003719',
  'Your code is 003719 to reset your password',
  'Your payment verification code is 003719',
])('does not offer genuine competition or unsupported purposes: %s', (text) => {
  expect(
    parseGenericCode({ subject: 'Verification code', text }).status,
  ).not.toBe('candidate');
});
it('retains plain/HTML alternative disagreement even with unrelated metadata', () => {
  const raw = new TextEncoder().encode(
    'Subject: Verification code\r\nContent-Type: multipart/alternative; boundary=p\r\n\r\n--p\r\nContent-Type: text/plain\r\n\r\nYour code is 003719. Request reference: 123456.\r\n--p\r\nContent-Type: text/html\r\n\r\n<p>Your code is 008417</p>\r\n--p--\r\n',
  );
  expect(parseGenericCode(normalizeRawEmail(raw, true)!).status).toBe(
    'ambiguous',
  );
});
it.each(cases)(
  'connected retrieval retains Fill confirmation with %s',
  async (_name, text) => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    const gate = createAccountGate(async () => ({
      userId: 'fixture',
      sessionId: 'fixture-session',
      expiresAt: 200000,
      label: 'Synthetic',
    }));
    const mailbox = createGmailLifecycle(
      {
        token: async () => ({
          token: 'synthetic-token',
          grantedScopes: [GMAIL_SCOPE],
        }),
        profile: async () => 'person@fixture.invalid',
        remove: async () => {},
        clear: async () => {},
        revoke: async () => true,
      },
      true,
    );
    await mailbox.connect();
    let click: (() => void) | undefined;
    const send = vi.fn(async () => true);
    const coordinator = createGmailPageCoordinator(
      {
        now: Date.now,
        id: () => 'synthetic-request',
        settings: () => ({ autofillEnabled: true, blockedOrigins: [] }),
        context: async () => ({
          accountId: '',
          mailboxId: 'person@fixture.invalid',
          tabId: 1,
          documentId: 'fixture-document',
          origin: 'https://unfamiliar.fixture.invalid',
          browserUrl: 'https://unfamiliar.fixture.invalid/login',
          policyUrl: 'https://unfamiliar.fixture.invalid/login',
          serviceId: 'generic',
          foreground: true,
        }),
        current: async () => true,
        confirm: async () =>
          new Promise<boolean>((resolve) => {
            click = () => resolve(true);
          }),
        send,
      },
      gate,
      mailbox,
      createGmailTransport(
        async (url) =>
          new Response(
            JSON.stringify(
              new URL(url).searchParams.has('format')
                ? {
                    id: 'synthetic-mail',
                    internalDate: '100000',
                    raw: Buffer.from(
                      'Subject: Verification code\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' +
                        text.replace(/\r?\n/g, '\r\n'),
                    ).toString('base64url'),
                  }
                : { messages: [{ id: 'synthetic-mail' }] },
            ),
          ),
      ),
    );
    try {
      const pending = coordinator.handle(
        {
          type: 'detect',
          groupId: 'fields',
          expectedLength: 6,
          emailFlow: true,
          groupCount: 1,
        },
        {},
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(click).toBeTypeOf('function');
      expect(send).not.toHaveBeenCalled();
      click!();
      expect(await pending).toEqual({ state: 'FILLED' });
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1]).toMatchObject([
        expect.anything(),
        { type: 'release', code: '003719' },
      ]);
    } finally {
      coordinator.dispose();
      gate.invalidate();
      mailbox.invalidate();
    }
  },
);
