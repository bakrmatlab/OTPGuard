import { expect, it } from 'vitest';
import { rawEmailHints } from '../packages/otp/raw';
import { recipientMatches } from '../packages/security/generic';
import { fixture } from './fixtures/email/dkim';

const hints = (headers: string[]) =>
  rawEmailHints(fixture({ headers, body: 'Your code is 003719\r\n' }).raw);

it.each([
  [
    '"decoy@fixture.invalid" <person@fixture.invalid>',
    ['person@fixture.invalid'],
  ],
  [
    'person@fixture.invalid (other@fixture.invalid)',
    ['person@fixture.invalid'],
  ],
  ['"Doe, Person" <person@fixture.invalid>', ['person@fixture.invalid']],
  [
    'People: person@fixture.invalid, other@fixture.invalid;',
    ['person@fixture.invalid', 'other@fixture.invalid'],
  ],
  ['"person"@fixture.invalid', ['person@fixture.invalid']],
  ['person!tag@fixture.invalid', ['person!tag@fixture.invalid']],
  [
    'person@fixture.invalid,\r\n\tOther <other@fixture.invalid>',
    ['person@fixture.invalid', 'other@fixture.invalid'],
  ],
])('parses complete structural recipients: %s', (value, recipients) => {
  expect(hints(['Subject: Login code', 'To: ' + value])?.recipients).toEqual(
    recipients,
  );
});

it.each([
  'other@fixture.invalid, broken <person@fixture.invalid',
  'other@fixture.invalid, person@[192.0.2.1]',
  'other@fixture.invalid, pérson@fixture.invalid',
  'other@fixture.invalid (unfinished',
  'other@fixture.invalid,',
])('retains uncertainty instead of a partial recipient set: %s', (value) => {
  expect(
    hints(['Subject: Login code', 'To: ' + value])?.recipients ?? [],
  ).toEqual([]);
});

it('duplicate recipient fields do not become complete evidence', () => {
  expect(
    hints(['Subject: Login code', 'To: other@fixture.invalid', 'To: broken'])
      ?.recipients ?? [],
  ).toEqual([]);
});

it.each([
  ['first.last+login@gmail.com', 'firstlast@gmail.com', true],
  ['first.last+login@work.invalid', 'firstlast@work.invalid', false],
  ['person@@gmail.com', 'person@gmail.com', false],
  ['.person@gmail.com', 'person@gmail.com', false],
  ['"person"@fixture.invalid', 'person@fixture.invalid', true],
])('compares only validated addresses %s / %s', (a, b, matches) => {
  expect(recipientMatches(a, b)).toBe(matches);
});

import {
  createCoordinator,
  type Adapter,
  type Envelope,
} from '../apps/extension/pipeline/coordinator';
import { createGmailPageCoordinator } from '../apps/extension/gmail/retrieval';
import { createGmailLifecycle } from '../apps/extension/gmail/lifecycle';
import { createAccountGate } from '../apps/extension/account/gate';
import { GMAIL_SCOPE } from '../apps/extension/gmail/config';
import { createGmailTransport } from '../apps/extension/gmail/transport';

it.each([
  [
    'malformed list',
    'other@fixture.invalid, broken <third@fixture.invalid',
    'UNKNOWN',
  ],
  [
    'unsupported member',
    'other@fixture.invalid, person@[192.0.2.1]',
    'UNKNOWN',
  ],
  ['valid punctuation', 'person!tag@fixture.invalid', 'UNKNOWN'],
  ['comment decoy', 'other@fixture.invalid (person@fixture.invalid)', 'FILLED'],
  [
    'quoted display decoy',
    '"person@fixture.invalid" <other@fixture.invalid>',
    'FILLED',
  ],
  ['genuine contradiction', 'other@fixture.invalid', 'FILLED'],
  ['personal Gmail alias', 'firstlast+another@gmail.com', 'UNKNOWN'],
  ['personal Gmail contradiction', 'other@gmail.com', 'FILLED'],
  ['Workspace literal', 'firstlast@work.invalid', 'FILLED'],
  ['local case uncertainty', 'person@fixture.invalid', 'UNKNOWN'],
  ['empty group', 'other@fixture.invalid, Undisclosed:;', 'UNKNOWN'],
  [
    'matching Cc',
    'other@fixture.invalid\r\nCc: person@fixture.invalid',
    'UNKNOWN',
  ],
  [
    'matching Bcc',
    'other@fixture.invalid\r\nBcc: person@fixture.invalid',
    'UNKNOWN',
  ],
  [
    'unsupported Cc',
    'other@fixture.invalid\r\nCc: person@[192.0.2.1]',
    'UNKNOWN',
  ],
  [
    'uncertain unreadable',
    'other@fixture.invalid, person@[192.0.2.1]',
    'UNKNOWN',
  ],
  ['contradictory unreadable', 'other@fixture.invalid', 'FILLED'],
])('connected recipient selection: %s', async (_name, to, state) => {
  const pageRecipient =
    _name === 'valid punctuation'
      ? 'person!tag@fixture.invalid'
      : _name.startsWith('personal Gmail')
        ? 'first.last+login@gmail.com'
        : _name === 'Workspace literal'
          ? 'first.last+login@work.invalid'
          : _name === 'local case uncertainty'
            ? 'Person@fixture.invalid'
            : 'person@fixture.invalid';
  const sent: unknown[] = [];
  const adapter: Adapter = {
    mode: 'user-confirmed',
    registry: [],
    now: () => 100000,
    id: () => 'request',
    settings: () => ({ autofillEnabled: true, blockedOrigins: [] }),
    context: async () => ({
      accountId: 'account',
      mailboxId: 'mailbox@fixture.invalid',
      tabId: 1,
      documentId: 'doc',
      origin: 'https://unknown.example',
      browserUrl: 'https://unknown.example/login',
      policyUrl: 'https://unknown.example/login',
      serviceId: 'generic',
      foreground: true,
    }),
    current: async () => true,
    retrieve: async () => [],
    confirm: async () => {
      expect(sent).toEqual([]);
      return true;
    },
    reserve: async () => true,
    send: async (_context, message) => {
      sent.push(message);
      return true;
    },
  };
  const gate = createAccountGate(
    async () => ({
      userId: 'account',
      sessionId: 'session',
      expiresAt: 200000,
      label: 'Synthetic',
    }),
    adapter.now,
  );
  const mailbox = createGmailLifecycle(
    {
      token: async () => ({
        token: 'synthetic-token',
        grantedScopes: [GMAIL_SCOPE],
      }),
      profile: async () => 'mailbox@fixture.invalid',
      remove: async () => {},
      clear: async () => {},
      revoke: async () => true,
    },
    true,
  );
  await mailbox.connect();
  const transport = createGmailTransport(async (url) => {
    const u = new URL(url);
    const second = u.pathname.endsWith('/b');
    return new Response(
      JSON.stringify(
        u.searchParams.has('format')
          ? {
              id: second ? 'b' : 'a',
              internalDate: '100000',
              raw: Buffer.from(
                fixture({
                  headers: [
                    'Subject: Login code',
                    'To: ' + (second ? to : pageRecipient),
                    'Content-Type: text/plain' +
                      (second && _name.endsWith('unreadable')
                        ? '; charset=unsupported-label'
                        : ''),
                  ],
                  body:
                    'Your code is ' + (second ? '008417' : '003719') + '\r\n',
                }).raw,
              ).toString('base64url'),
            }
          : { messages: [{ id: 'a' }, { id: 'b' }] },
      ),
    );
  });
  const coordinator = createGmailPageCoordinator(
    adapter,
    gate,
    mailbox,
    transport,
  );
  try {
    expect(
      (
        await coordinator.handle(
          {
            type: 'detect',
            groupId: 'fields-1',
            expectedLength: 6,
            emailFlow: true,
            groupCount: 1,
            recipient: pageRecipient,
          },
          {},
        )
      ).state,
    ).toBe(state);
    expect(
      sent.some((v) => Reflect.get(v as object, 'type') === 'release'),
    ).toBe(state === 'FILLED');
  } finally {
    coordinator.dispose();
  }
});

it('coordinator does not exclude a malformed recipient envelope', async () => {
  const envelope: Envelope = {
    messageId: 'a',
    mailboxId: 'mailbox',
    receivedAt: 100000,
    sender: { status: 'unknown' },
    email: { subject: 'Login code', text: 'Your code is 003719' },
  };
  const sent: unknown[] = [];
  const adapter: Adapter = {
    mode: 'user-confirmed',
    registry: [],
    now: () => 100000,
    id: () => 'request',
    context: async () => ({
      accountId: 'account',
      mailboxId: 'mailbox',
      tabId: 1,
      documentId: 'doc',
      origin: 'https://unknown.example',
      browserUrl: 'https://unknown.example/login',
      policyUrl: 'https://unknown.example/login',
      serviceId: 'generic',
      foreground: true,
    }),
    current: async () => true,
    retrieve: async () => [
      envelope,
      {
        ...envelope,
        messageId: 'b',
        recipients: ['other@fixture.invalid', 'broken'],
      },
    ],
    confirm: async () => true,
    reserve: async () => true,
    send: async (_context, message) => {
      sent.push(message);
      return true;
    },
  };
  const coordinator = createCoordinator(adapter);
  try {
    expect(
      (
        await coordinator.handle(
          {
            type: 'detect',
            groupId: 'fields-1',
            expectedLength: 6,
            emailFlow: true,
            groupCount: 1,
            recipient: 'person@fixture.invalid',
          },
          {},
        )
      ).state,
    ).toBe('UNKNOWN');
    expect(sent).toEqual([]);
  } finally {
    coordinator.dispose();
  }
});

import {
  parseAddressList,
  parseMailboxAddress,
  displayedRecipient,
} from '../packages/otp/addresses';
import { recipientContradiction } from '../packages/security/generic';
import { parseClient } from '../apps/extension/pipeline/protocol';

it.each([
  [
    'Person (nested (ignore@fixture.invalid)) <person@fixture.invalid>',
    ['person@fixture.invalid'],
  ],
  ['"Doe, \\"Person\\"" <person@fixture.invalid>', ['person@fixture.invalid']],
  [
    '=?UTF-8?Q?person=40fixture.invalid?= <other@fixture.invalid>',
    ['other@fixture.invalid'],
  ],
  ['person (comment) @ fixture.invalid', ['person@fixture.invalid']],
  ['person@FIXTURE.INVALID', ['person@fixture.invalid']],
  ['"a@b"@fixture.invalid', ['"a@b"@fixture.invalid']],
  ['"a b"@fixture.invalid', ['"a b"@fixture.invalid']],
  ['"a\\"b"@fixture.invalid', ['"a\\"b"@fixture.invalid']],
  ['Group:;', []],
  ['Group:;, other@fixture.invalid', []],
  ['other@fixture.invalid, Group:;', []],
])('understands bounded structural variants: %s', (value, result) => {
  expect(parseAddressList(value)).toEqual(result);
});

it.each([
  'person..tag@fixture.invalid',
  'person@-fixture.invalid',
  'person@fixture..invalid',
  '@fixture.invalid',
  'person@@fixture.invalid',
  '<@route.invalid:person@fixture.invalid>',
  'Group: person@fixture.invalid',
  'Group: person@fixture.invalid; "hidden@fixture.invalid"',
  'Group: person@fixture.invalid,;',
  'person@fixture.invalid\r\nBcc: hidden@fixture.invalid',
  '"broken@fixture.invalid',
  'Name person@fixture.invalid',
  'person@fixture.invalid garbage',
  'Outer: Inner: person@fixture.invalid;;',
])('unsupported syntax is never a partial list: %s', (value) => {
  expect(parseAddressList(value)).toBeNull();
});

it('limits work without returning partial addresses', () => {
  expect(
    parseAddressList('person@fixture.invalid,' + 'a'.repeat(8192)),
  ).toBeNull();
  expect(
    parseAddressList(
      '('.repeat(9) + 'comment' + ')'.repeat(9) + 'person@fixture.invalid',
    ),
  ).toBeNull();
  expect(
    parseAddressList(Array(101).fill('person@fixture.invalid').join(',')),
  ).toBeNull();
  expect(parseMailboxAddress('a'.repeat(65) + '@fixture.invalid')).toBeNull();
});

it.each([
  [undefined, 'person@fixture.invalid', false],
  [[], 'person@fixture.invalid', false],
  [['other@fixture.invalid'], undefined, false],
  [['other@fixture.invalid', 'broken'], 'person@fixture.invalid', false],
  [['person@fixture.invalid'], 'PERSON@fixture.invalid', false],
  [['first.last+one+two@gmail.com'], 'firstlast@gmail.com', false],
  [['First.Last+login@googlemail.com'], 'firstlast@gmail.com', false],
  [['first.last+login@work.invalid'], 'firstlast@work.invalid', true],
  [['firstlast@gmail.com'], 'firstlast@work.invalid', true],
  [['person_name@gmail.com'], 'personname@gmail.com', false],
  [['other@fixture.invalid'], 'person@fixture.invalid', true],
] as const)(
  'contradiction requires complete understood evidence %j / %s',
  (recipients, page, contradicts) => {
    expect(recipientContradiction(recipients, page)).toBe(contradicts);
  },
);

it.each([
  ['Sent to person!tag@fixture.invalid', 'person!tag@fixture.invalid'],
  ['Sent to "person"@fixture.invalid', 'person@fixture.invalid'],
  ['Sent to Person@fixture.invalid', 'Person@fixture.invalid'],
  ['Sent to first.last+login@gmail.com', 'first.last+login@gmail.com'],
  ['Sent to pérson@fixture.invalid', undefined],
  ['Sent to person@fixture.invalid/bad', undefined],
  ['Sent to person@fixture.invalid..', undefined],
  ['Sent to person@fixture.invalid and broken@@fixture.invalid', undefined],
  ['Sent to person@fixture.invalid or other@fixture.invalid', undefined],
  ['Sent to p***@fixture.invalid', undefined],
  ['Sent to mailto:person@fixture.invalid', undefined],
  ['Sent to "a b"@fixture.invalid', undefined],
])('rendered page recipient tokens are complete: %s', (text, recipient) => {
  expect(displayedRecipient(text)).toBe(recipient);
});

it('content schema accepts validated variants and refuses malformed hints', () => {
  const detection = {
    type: 'detect',
    groupId: 'fields',
    expectedLength: 6,
    emailFlow: true,
    groupCount: 1,
  };
  expect(
    parseClient({ ...detection, recipient: 'person!tag@fixture.invalid' }),
  ).not.toBeNull();
  expect(
    parseClient({ ...detection, recipient: '"person"@fixture.invalid' }),
  ).not.toBeNull();
  expect(
    parseClient({ ...detection, recipient: 'person@@fixture.invalid' }),
  ).toBeNull();
});

it('all ASCII atext characters survive whole recipient parsing', () => {
  for (const ch of "!#$%&'*+-/=?^_`{|}~") {
    const address = 'person' + ch + 'tag@fixture.invalid';
    expect(parseAddressList('Person <' + address + '>')).toEqual([address]);
    expect(displayedRecipient('Sent to ' + address)).toBe(
      ch === '*' ? undefined : address,
    );
  }
});

it('invalid long display phrases and hidden empty groups are bounded uncertainty', () => {
  expect(
    parseAddressList('a'.repeat(8000) + '@ <person@fixture.invalid>'),
  ).toBeNull();
  expect(
    hints(['To: other@fixture.invalid', 'Cc: Undisclosed:;'])?.recipients,
  ).toEqual([]);
  expect(hints(['To: other@fixture.invalid', 'Bcc:'])?.recipients).toEqual([]);
  expect(
    hints(['To: other@fixture.invalid', 'Cc: broken'])?.recipients,
  ).toEqual([]);
});
