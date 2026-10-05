import { expect, it, vi } from 'vitest';
import { normalizeRawEmail, parseVerificationCode } from '../packages/otp';
import { createDkimResolver } from '../apps/extension/gmail/dns';
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
  expect(parseVerificationCode(email!)).toMatchObject({
    status: 'candidate',
    candidate: { code: '003719' },
  });
  expect(
    parseVerificationCode({ ...email!, text: email!.text + '\n008417' }).status,
  ).toBe('rejected');
  expect(normalizeRawEmail(new Uint8Array(256 * 1024 + 1))).toBeNull();
  expect(
    normalizeRawEmail(
      fixture({ headers: ['Subject: Sign in', 'Content-Type: message/rfc822'] })
        .raw,
    ),
  ).toBeNull();
});

it('refuses incomplete DNS and unrelated TXT; follows only a bounded answer CNAME chain', async () => {
  const name = 'test._domainkey.mailer.example';
  const base = {
    Status: 0,
    TC: false,
    CD: false,
    Question: [{ name: name + '.', type: 16 }],
  };
  const data = {
    ...base,
    Answer: [
      { name: name + '.', type: 5, data: 'key.example.' },
      { name: 'key.example.', type: 16, data: '"v=DKIM1; ""p=public"' },
    ],
  };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(data)));
  expect(
    await createDkimResolver(fetcher)(name, new AbortController().signal),
  ).toEqual(['v=DKIM1; p=public']);
  const [url, options] = fetcher.mock.calls[0]! as unknown as [
    string,
    RequestInit,
  ];
  expect(new URL(url).searchParams.get('edns_client_subnet')).toBe('0.0.0.0/0');
  expect(options.credentials).toBe('omit');
  expect(options.redirect).toBe('error');
  for (const bad of [
    { ...data, TC: true },
    { ...data, CD: true },
    { ...data, Status: 2 },
    {
      ...data,
      Answer: [{ name: 'unrelated.example', type: 16, data: '"p=forged"' }],
    },
  ]) {
    await expect(
      createDkimResolver(async () => new Response(JSON.stringify(bad)))(
        name,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  }
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
