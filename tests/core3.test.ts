import { expect, it } from 'vitest';
import { normalizeRawEmail, parseGenericCode } from '../packages/otp';
import { createReleaseLedger } from '../apps/extension/pipeline/replay';
import { fixture } from './fixtures/email/dkim';

it('normalizes bounded signed related/alternative quoted-printable plain text without rendering HTML', () => {
  const raw = fixture({
    headers: [
      'From: codes@mailer.example',
      'To: owner@example.test',
      'Subject: Your login code is 003719',
      'Content-Type: multipart/related; boundary="outer"',
    ],
    body: '--outer\r\nContent-Type: multipart/alternative; boundary="inner"\r\n\r\n--inner\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nLog in to your Canva Account\r\nEnter this code within the next 10 minutes to log in to your Canva Account.\r\n003719\r\nCanva Pty Ltd, 110 Kippax St, NSW 2010, Australia\r\nABN 80 158 929 938\r\n--inner\r\nContent-Type: text/html\r\n\r\n<p>003719</p>\r\n--inner--\r\n--outer--\r\n',
  });
  const email = normalizeRawEmail(raw.raw);
  expect(email).not.toBeNull();
  expect(parseGenericCode(email!)).toMatchObject({
    status: 'candidate',
    candidate: { code: '003719' },
  });
  expect(normalizeRawEmail(new Uint8Array(256 * 1024 + 1))).toBeNull();
  expect(
    normalizeRawEmail(
      fixture({ headers: ['Subject: Sign in', 'Content-Type: message/rfc822'] })
        .raw,
    ),
  ).toBeNull();
});

it('reserves before send and refuses replay across every uncertain crash/ack window', async () => {
  for (const window of [
    'before-send',
    'after-send',
    'before-ack',
    'after-ack',
  ]) {
    let stored: unknown;
    const store = {
      read: async () => stored,
      write: async (v: unknown) => {
        stored = v;
      },
    };
    expect(
      await createReleaseLedger(store, () => 1000000).reserve(
        'account',
        'mailbox',
        'message-' + window,
      ),
    ).toBe(true);
    const restarted = createReleaseLedger(store, () => 1000001);
    expect(
      await restarted.reserve('account', 'mailbox', 'message-' + window),
    ).toBe(false);
    expect(JSON.stringify(stored)).not.toContain('mailbox');
    expect(JSON.stringify(stored)).not.toContain('message-');
  }
  expect(
    await createReleaseLedger({
      read: async () => ({ corrupt: true }),
      write: async () => {},
    }).reserve('a', 'b', 'm'),
  ).toBe(false);
  expect(
    await createReleaseLedger({
      read: async () => undefined,
      write: async () => {
        throw Error();
      },
    }).reserve('a', 'b', 'm'),
  ).toBe(false);
});
