import { createProgress } from '../apps/extension/pipeline/progress';
import { expect, it, vi } from 'vitest';
import { parseGenericCode, normalizeRawEmail } from '../packages/otp';
import { assessGenericCandidate } from '../packages/security/generic';
import {
  createCoordinator,
  type Adapter,
  type Envelope,
} from '../apps/extension/pipeline/coordinator';
import { createGmailTransport } from '../apps/extension/gmail/transport';
import { fixture } from './fixtures/email/dkim';

it.each([
  ['Your security code', 'Use this code to sign in: 003719', '003719'],
  ['Verify your email', 'Your verification code is: 003719', '003719'],
  ['Your login code is 003719', '003719\nExpires in 10 minutes.', '003719'],
  ['Sign in', 'Your one-time password:\n003719', '003719'],
])(
  'extracts generic numeric codes with explicit context: %s',
  (subject, text, code) => {
    expect(parseGenericCode({ subject, text })).toMatchObject({
      status: 'candidate',
      candidate: { code },
    });
  },
);
it.each([
  ['Order 003719', 'Order confirmed'],
  ['Security code', 'Reset your password with 003719'],
  ['Sign in', 'Your login code is 003719\nYour login code is 008417'],
  ['Security code', '> Your code is 003719'],
  ['Security code', 'No code yet'],
])('refuses unrelated/unsupported/ambiguous mail: %s', (subject, text) => {
  expect(parseGenericCode({ subject, text }).status).not.toBe('candidate');
});
it('extracts inert HTML and combines alternatives without hiding distinct codes', () => {
  const raw = fixture({
    headers: ['Subject: Login code', 'Content-Type: text/html; charset=utf-8'],
    body: '<style>p{color:red}</style><p>Your verification code is <b>003719</b></p>',
  }).raw;
  expect(normalizeRawEmail(raw)).toBeNull();
  expect(parseGenericCode(normalizeRawEmail(raw, true)!)).toMatchObject({
    status: 'candidate',
    candidate: { code: '003719' },
  });
});
function setup() {
  let now = 100000;
  let current = true;
  const sent: unknown[] = [];
  const envelope: Envelope = {
    messageId: 'synthetic',
    mailboxId: 'mailbox',
    receivedAt: now,
    sender: { status: 'unknown' },
    email: { subject: 'Sign in', text: 'Your verification code is 003719' },
  };
  const adapter: Adapter = {
    mode: 'user-confirmed',
    registry: [],
    now: () => now,
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
    current: async () => current,
    retrieve: async () => [envelope],
    confirm: async () => true,
    reserve: async () => true,
    send: async (_context, message) => {
      sent.push(message);
      return true;
    },
  };
  const detect = {
    type: 'detect',
    groupId: 'fields-1',
    expectedLength: 6,
    emailFlow: true,
    groupCount: 1,
  };
  return {
    adapter,
    envelope,
    detect,
    sent,
    advance: () => {
      now += 30000;
    },
    invalidate: () => {
      current = false;
    },
  };
}
it('never labels a generic match VERIFIED or sends a code before Fill, then binds a leading-zero release', async () => {
  const t = setup();
  let click!: (v: boolean) => void;
  t.adapter.confirm = () =>
    new Promise((resolve) => {
      click = resolve;
    });
  const coordinator = createCoordinator(t.adapter);
  const result = coordinator.handle(t.detect, {});
  await vi.waitFor(() =>
    expect(coordinator.status()).toEqual({ state: 'CANDIDATE' }),
  );
  expect(t.sent).toEqual([]);
  click(true);
  expect(await result).toEqual({ state: 'FILLED' });
  expect(t.sent).toMatchObject([
    { type: 'prepare', expectedLength: 6 },
    { type: 'release', code: '003719', expectedLength: 6 },
  ]);
  coordinator.dispose();
});
it.each([
  'missing-confirm',
  'declined',
  'expired',
  'navigation',
  'ambiguous',
  'wrong-length',
  'wrong-mailbox',
  'stale',
  'block',
  'reserve',
])('generic mode refuses %s', async (scenario) => {
  const t = setup();
  if (scenario === 'missing-confirm') delete t.adapter.confirm;
  if (scenario === 'declined') t.adapter.confirm = async () => false;
  if (scenario === 'expired')
    t.adapter.confirm = async () => {
      t.advance();
      return true;
    };
  if (scenario === 'navigation')
    t.adapter.confirm = async () => {
      t.invalidate();
      return true;
    };
  if (scenario === 'ambiguous')
    t.adapter.retrieve = async () => [
      t.envelope,
      { ...t.envelope, messageId: 'second' },
    ];
  if (scenario === 'wrong-length') t.detect.expectedLength = 8;
  if (scenario === 'wrong-mailbox') t.envelope.mailboxId = 'other';
  if (scenario === 'stale') t.envelope.receivedAt = 1;
  if (scenario === 'block')
    t.adapter.settings = () => ({
      autofillEnabled: true,
      blockedOrigins: ['https://unknown.example'],
    });
  if (scenario === 'reserve') t.adapter.reserve = async () => false;
  const c = createCoordinator(t.adapter);
  expect((await c.handle(t.detect, {})).state).not.toBe('FILLED');
  expect(
    t.sent.some((v) => Reflect.get(v as object, 'type') === 'release'),
  ).toBe(false);
  c.dispose();
});
it('unknown field length is resolved from the selected code, never passed as zero to release', async () => {
  const t = setup();
  t.detect.expectedLength = 0;
  const c = createCoordinator(t.adapter);
  expect(await c.handle(t.detect, {})).toEqual({ state: 'FILLED' });
  expect(t.sent).toMatchObject([{ expectedLength: 6 }, { expectedLength: 6 }]);
  c.dispose();
});
it('generic Gmail search is bounded by time without sender/domain/page-derived filters', async () => {
  const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify({ messages: [] })),
  );
  await createGmailTransport(fetcher).cycle(
    'synthetic',
    [],
    100000,
    new AbortController().signal,
    'raw',
    true,
  );
  const url = new URL(fetcher.mock.calls[0]![0] as unknown as string);
  expect(url.searchParams.get('q')).toBe('after:40 before:160');
  expect(url.searchParams.get('maxResults')).toBe('20');
});
it('generic assessment refuses non-HTTPS without asserting sender trust', () => {
  expect(
    assessGenericCandidate({
      serviceId: 'generic',
      now: 100000,
      locallyBlocked: false,
      request: {
        mailboxId: 'mailbox',
        startedAt: 100000,
        deadline: 160000,
        url: 'http://unknown.example',
        topLevel: true,
        current: true,
        foreground: true,
        emailFlow: true,
        purpose: 'sign-in',
        expectedLength: 6,
        competingChallenges: 0,
      },
      messages: [],
    }),
  ).toEqual({ state: 'UNKNOWN', reason: 'request' });
});

it('ignores unrelated footer years and addresses but retains two explicitly labeled code ambiguity', () => {
  const email = {
    subject: 'Your login code is 003719',
    text: 'Enter this code to log in: 003719\nExample Inc. 110 Street, 2010\nCopyright 2026',
  };
  expect(parseGenericCode(email)).toMatchObject({
    status: 'candidate',
    candidate: { code: '003719' },
  });
  expect(
    parseGenericCode({
      ...email,
      text: email.text + '\nYour verification code is 008417',
    }).status,
  ).toBe('ambiguous');
});

it.each([
  'single',
  'two-emails',
  'malformed',
  'unrelated-plus-code',
  'unreadable-newsletter-plus-code',
  'unreadable-code-plus-code',
  'encoded-canva',
  'html-alternative',
  'inline-copyright',
  'request-metadata',
])(
  'actual connected generic retrieval handles %s without a service mapping or DNS',
  async (scenario) => {
    const { createGmailPageCoordinator } =
      await import('../apps/extension/gmail/retrieval');
    const { createGmailLifecycle } =
      await import('../apps/extension/gmail/lifecycle');
    const { createAccountGate } =
      await import('../apps/extension/account/gate');
    const { GMAIL_SCOPE } = await import('../apps/extension/gmail/config');
    const t = setup();
    t.adapter.settings = () => ({ autofillEnabled: true, blockedOrigins: [] });
    const gate = createAccountGate(
      async () => ({
        userId: 'account',
        sessionId: 'session',
        expiresAt: 200000,
        label: 'Synthetic',
      }),
      t.adapter.now,
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
    expect((await mailbox.connect()).state).toBe('CONNECTED');
    const context = t.adapter.context;
    t.adapter.context = async (sender) => {
      const value = await context(sender);
      return value ? { ...value, mailboxId: 'mailbox@fixture.invalid' } : null;
    };
    let code = fixture({
      headers: [
        scenario === 'encoded-canva' || scenario === 'html-alternative'
          ? 'Subject: =?UTF-8?B?' +
            Buffer.from('Your login code is 003719').toString('base64') +
            '?='
          : 'Subject: Your verification code',
        'Content-Type: text/plain; charset=utf-8',
      ],
      body:
        scenario === 'encoded-canva' || scenario === 'html-alternative'
          ? 'Log in to your Canva Account\r\nEnter this code within the next 10 minutes to log in to your Canva Account.\r\n003719\r\nCanva Pty Ltd, 110 Kippax St, NSW 2010, Australia\r\n'
          : scenario === 'inline-copyright'
            ? 'Your verification code is 003719. © 2026 Example\r\n'
            : scenario === 'request-metadata'
              ? 'Verification code\r\nEnter the following verification code when prompted:\r\n003719\r\nTo protect your account, do not share this code.\r\nDid not request this?\r\nThis code was requested from 192.0.2.10, Example City at 05 October 2026, 17:15 UTC. If you did not make this request, ignore this email.\r\n© 2026 Example\r\n'
              : 'Your verification code is 003719\r\n',
    }).raw;
    if (scenario === 'html-alternative')
      code = fixture({
        headers: [
          'Subject: Your login code is 003719',
          'Content-Type: multipart/alternative; boundary="parts"',
        ],
        body: '--parts\r\nContent-Type: text/plain\r\n\r\nYour login code is 003719\r\n--parts\r\nContent-Type: text/html\r\n\r\n<p>Your login code is <b>003719</b></p><footer>&copy; 2026 Example &mdash; do not share your code</footer>\r\n--parts--\r\n',
      }).raw;
    const unrelated = fixture({
      headers: ['Subject: Newsletter', 'Content-Type: text/plain'],
      body: 'A normal update with no login code.\r\n',
    }).raw;
    const raw = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
    const ids = [
      'two-emails',
      'unrelated-plus-code',
      'unreadable-newsletter-plus-code',
      'unreadable-code-plus-code',
    ].includes(scenario)
      ? ['a', 'b']
      : ['a'];
    const urls: string[] = [];
    const transport = createGmailTransport(async (url) => {
      urls.push(url);
      const u = new URL(url);
      return new Response(
        JSON.stringify(
          u.searchParams.has('format')
            ? {
                id: u.pathname.split('/').at(-1),
                internalDate: '100000',
                snippet:
                  scenario === 'unreadable-newsletter-plus-code'
                    ? 'This week in product news'
                    : 'Your verification code is 003719',
                raw:
                  scenario === 'malformed'
                    ? 'invalid'
                    : raw(
                        [
                          'unreadable-newsletter-plus-code',
                          'unreadable-code-plus-code',
                        ].includes(scenario) && u.pathname.endsWith('/b')
                          ? fixture({
                              headers: [
                                scenario === 'unreadable-newsletter-plus-code'
                                  ? 'Subject: Weekly digest'
                                  : 'Subject: Login code',
                                'Content-Type: text/plain; charset=unknown',
                              ],
                              body: 'Unreadable',
                            }).raw
                          : scenario === 'unrelated-plus-code' &&
                              u.pathname.endsWith('/b')
                            ? unrelated
                            : code,
                      ),
              }
            : { messages: ids.map((id) => ({ id })) },
        ),
      );
    }, t.adapter.now);
    const issues: (string | null)[] = [];
    const coordinator = createGmailPageCoordinator(
      t.adapter,
      gate,
      mailbox,
      transport,
      undefined,
      (issue) => {
        issues.push(issue);
      },
    );
    try {
      expect((await coordinator.handle(t.detect, {})).state).toBe(
        scenario === 'single' ||
          scenario === 'unrelated-plus-code' ||
          scenario === 'unreadable-newsletter-plus-code' ||
          scenario === 'encoded-canva' ||
          scenario === 'html-alternative' ||
          scenario === 'inline-copyright' ||
          scenario === 'request-metadata'
          ? 'FILLED'
          : 'UNKNOWN',
      );
      expect(issues).toEqual(
        scenario === 'malformed'
          ? [null, 'mime-headers']
          : scenario === 'unreadable-code-plus-code'
            ? [null, 'mime-charset']
            : [null],
      );
      expect(
        urls.every((url) => url.startsWith('https://gmail.googleapis.com/')),
      ).toBe(true);
      expect(new URL(urls[0]!).searchParams.get('q')).toBe(
        'after:40 before:160',
      );
      expect(
        t.sent.some((v) => Reflect.get(v as object, 'type') === 'release'),
      ).toBe(
        scenario === 'single' ||
          scenario === 'unrelated-plus-code' ||
          scenario === 'unreadable-newsletter-plus-code' ||
          scenario === 'encoded-canva' ||
          scenario === 'html-alternative' ||
          scenario === 'inline-copyright' ||
          scenario === 'request-metadata',
      );
    } finally {
      coordinator.dispose();
      gate.invalidate();
      mailbox.invalidate();
    }
  },
);

it.each([
  ['=?UTF-8?Q?Your_login_code_is_003719?=', 'Your login code is 003719'],
  [
    '=?UTF-8?Q?Your_login_?= =?UTF-8?B?Y29kZSBpcyAwMDM3MTk=?=',
    'Your login code is 003719',
  ],
])(
  'decodes ordinary encoded subjects only in generic mode: %s',
  (subject, expected) => {
    const raw = fixture({
      headers: ['Subject: ' + subject, 'Content-Type: text/plain'],
      body: '003719\r\n',
    }).raw;
    expect(normalizeRawEmail(raw)).toBeNull();
    expect(normalizeRawEmail(raw, true)?.subject).toBe(expected);
  },
);
it.each([
  '=?UTF-8?B?invalid?=',
  '=?UTF-8?Q?code=0A003719?=',
  '=?unknown?Q?Your_code_003719?=',
  '=?UTF-8?Q?Your_code=ZZ003719?=',
])('refuses malformed or unsafe encoded subjects: %s', (subject) => {
  expect(
    normalizeRawEmail(fixture({ headers: ['Subject: ' + subject] }).raw, true),
  ).toBeNull();
});

it('retains previously working plain text with ordinary HTML copyright entities', () => {
  const raw = fixture({
    headers: [
      'Subject: Your login code is 003719',
      'Content-Type: multipart/alternative; boundary="parts"',
    ],
    body: '--parts\r\nContent-Type: text/plain\r\n\r\nYour login code is 003719\r\n--parts\r\nContent-Type: text/html\r\n\r\n<p>Your login code is <b>003719</b></p><footer>&copy; 2026 Example &mdash; do not share your code</footer>\r\n--parts--\r\n',
  }).raw;
  expect(normalizeRawEmail(raw)).not.toBeNull();
  expect(normalizeRawEmail(raw, true)).not.toBeNull();
});

it('keeps alternative-code ambiguity and encoded unsafe controls after HTML entity decoding', () => {
  const email = (html: string) =>
    normalizeRawEmail(
      fixture({
        headers: [
          'Subject: Login code',
          'Content-Type: text/html; charset=utf-8',
        ],
        body: html,
      }).raw,
      true,
    );
  expect(
    parseGenericCode(
      email(
        '<p>Your code is &#48;03719</p><p>Your code is 008417</p><footer>&copy; 2026</footer>',
      )!,
    ).status,
  ).toBe('ambiguous');
  expect(email('<p>Your code is 003719</p>&#0;')).toBeNull();
  expect(email('<p>Your code is 003719</p>&#x202e;')).toBeNull();
  expect(
    email(
      '<p>Your code is 003719</p><footer>&lt;Example&gt; &unknown;</footer>',
    ),
  ).not.toBeNull();
});

it('does not mistake a footer year before a code-sharing reminder for a second code', () => {
  expect(
    parseGenericCode({
      subject: 'Your login code is 003719',
      text: 'Your code is 003719\n© 2026 Example — do not share your code',
    }),
  ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
  expect(
    parseGenericCode({
      subject: '003719 is your verification code',
      text: 'Sign in.',
    }),
  ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
});

it('accepts HTML preheader padding without joining invisible code fragments', () => {
  const normalize = (body: string) =>
    normalizeRawEmail(
      fixture({
        headers: [
          'Subject: Login code',
          'Content-Type: text/html; charset=utf-8',
        ],
        body,
      }).raw,
      true,
    );
  expect(
    parseGenericCode(
      normalize('<div>&zwnj;&nbsp;&#8203;</div><p>Your code is 003719</p>')!,
    ),
  ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
  expect(
    parseGenericCode(normalize('<p>Your code is 003&zwnj;719</p>')!).status,
  ).toBe('rejected');
});

it('excludes incompatible numeric lengths before assessing competing messages', async () => {
  const t = setup();
  t.adapter.retrieve = async () => [
    t.envelope,
    {
      ...t.envelope,
      messageId: 'four',
      email: { subject: 'Login code', text: 'Your code is 0037' },
    },
  ];
  const c = createCoordinator(t.adapter);
  expect(await c.handle(t.detect, {})).toEqual({ state: 'FILLED' });
  expect(t.sent).toMatchObject([{ type: 'prepare' }, { code: '003719' }]);
  c.dispose();
});
it('retry preserves the challenge window and resend excludes the previous code', async () => {
  const t = setup();
  const windows: unknown[] = [];
  t.adapter.retrieve = async (context) => {
    windows.push(context.requestWindow);
    return [t.envelope];
  };
  t.adapter.reserve = async () => false;
  const c = createCoordinator(t.adapter);
  await c.handle(t.detect, {});
  t.advance();
  await c.handle({ ...t.detect, manual: true }, {});
  await c.handle({ ...t.detect, manual: true, fresh: true }, {});
  expect(windows).toMatchObject([
    { startedAt: 100000, notBefore: 40000, expectedLength: 6 },
    { startedAt: 100000, notBefore: 40000, expectedLength: 6 },
    { startedAt: 130000, notBefore: 129000, expectedLength: 6 },
  ]);
  expect(c.status()).toEqual({ state: 'NO_CODE' });
  c.dispose();
});

it('explicit recipient contradiction excludes a competing code, while missing recipient stays ambiguous', async () => {
  const t = setup();
  const second: Envelope = {
    ...t.envelope,
    messageId: 'second',
    recipients: ['other@fixture.invalid'],
  };
  t.envelope.recipients = ['person@fixture.invalid'];
  t.adapter.retrieve = async () => [t.envelope, second];
  const c = createCoordinator(t.adapter);
  expect(
    await c.handle({ ...t.detect, recipient: 'person@fixture.invalid' }, {}),
  ).toEqual({ state: 'FILLED' });
  delete second.recipients;
  expect(
    (
      await c.handle(
        { ...t.detect, manual: true, recipient: 'person@fixture.invalid' },
        {},
      )
    ).state,
  ).toBe('UNKNOWN');
  c.dispose();
});

it('resend supersedes a pending confirmation without releasing the previous code', async () => {
  const t = setup();
  let ids = 0;
  t.adapter.id = () => 'request-' + ++ids;
  let confirmations = 0;
  t.adapter.confirm = async (_context, _binding, signal) => {
    if (++confirmations > 1) return true;
    return new Promise((resolve) =>
      signal.addEventListener('abort', () => resolve(false), { once: true }),
    );
  };
  const c = createCoordinator(t.adapter);
  const previous = c.handle(t.detect, {});
  await vi.waitFor(() => expect(c.status()).toEqual({ state: 'CANDIDATE' }));
  t.advance();
  t.envelope.receivedAt = 130000;
  t.envelope.messageId = 'resent';
  t.envelope.email.text = 'Your code is 008417';
  expect(await c.handle({ ...t.detect, fresh: true }, {})).toEqual({
    state: 'FILLED',
  });
  expect((await previous).state).toBe('CANCELLED');
  expect(c.status()).toEqual({ state: 'FILLED' });
  expect(t.sent).toMatchObject([
    { type: 'prepare', requestId: 'request-2' },
    { type: 'release', code: '008417' },
  ]);
  c.dispose();
});

it('service hints disambiguate explicitly branded other-service mail but never hide generic provider mail', async () => {
  const t = setup();
  t.envelope.senderDomain = 'unknown.example';
  const other: Envelope = {
    ...t.envelope,
    messageId: 'other',
    senderDomain: 'canva.example',
    email: {
      subject: 'Your Canva verification code',
      text: 'Your code is 008417',
    },
  };
  t.adapter.retrieve = async () => [t.envelope, other];
  const c = createCoordinator(t.adapter);
  expect(await c.handle(t.detect, {})).toEqual({ state: 'FILLED' });
  other.email.subject = 'Your verification code';
  expect((await c.handle({ ...t.detect, manual: true }, {})).state).toBe(
    'UNKNOWN',
  );
  c.dispose();
});

it('an early email-request gesture supplies the window when the code form appears later', async () => {
  const t = setup();
  const windows: unknown[] = [];
  t.adapter.retrieve = async (context) => {
    windows.push(context.requestWindow);
    return [t.envelope];
  };
  const c = createCoordinator(t.adapter);
  await c.handle({ type: 'challenge' }, {});
  expect(windows).toEqual([]);
  t.advance();
  t.envelope.receivedAt = 110000;
  expect(await c.handle(t.detect, {})).toEqual({ state: 'FILLED' });
  expect(windows).toMatchObject([{ startedAt: 100000, notBefore: 99000 }]);
  c.dispose();
});

it('replacement cancels stale field approval and preserves the email challenge window', async () => {
  const t = setup();
  let ids = 0;
  t.adapter.id = () => 'replacement-' + ++ids;
  const windows: unknown[] = [];
  t.adapter.retrieve = async (context) => {
    windows.push(context.requestWindow);
    return [t.envelope];
  };
  let confirmations = 0;
  t.adapter.confirm = async (_context, _binding, signal) =>
    ++confirmations > 1
      ? true
      : new Promise((resolve) =>
          signal.addEventListener('abort', () => resolve(false), {
            once: true,
          }),
        );
  const c = createCoordinator(t.adapter);
  const old = c.handle(t.detect, {});
  await vi.waitFor(() => expect(c.status()).toEqual({ state: 'CANDIDATE' }));
  t.advance();
  expect(
    await c.handle({ ...t.detect, groupId: 'fields-2', replacement: true }, {}),
  ).toEqual({ state: 'FILLED' });
  expect((await old).state).toBe('CANCELLED');
  expect(windows).toMatchObject([
    { startedAt: 100000, notBefore: 40000 },
    { startedAt: 100000, notBefore: 40000 },
  ]);
  expect(t.sent).toMatchObject([
    { groupId: 'fields-2' },
    { groupId: 'fields-2', code: '003719' },
  ]);
  c.dispose();
});

it('status refuses an expired search even before a delayed deadline timer runs', async () => {
  const t = setup();
  t.adapter.retrieve = () => new Promise(() => {});
  const c = createCoordinator(t.adapter);
  void c.handle(t.detect, {});
  await vi.waitFor(() => expect(c.status()).toEqual({ state: 'SEARCHING' }));
  t.advance();
  t.advance();
  t.advance();
  expect(c.status()).toEqual({ state: 'CANCELLED' });
  expect(t.sent).toEqual([]);
  c.dispose();
});

it('reports selection, approval and insertion stages without mail or code data', async () => {
  const t = setup();
  const stages: string[] = [];
  t.adapter.progress = (stage) => stages.push(stage);
  const c = createCoordinator(t.adapter);
  expect(await c.handle(t.detect, {})).toEqual({ state: 'FILLED' });
  expect(stages).toEqual([
    'polling',
    'selecting',
    'approval',
    'preparing',
    'replay',
    'filling',
  ]);
  c.dispose();
});
it('keeps bounded volatile stage history with independent elapsed clocks', () => {
  let now = 1000;
  const p = createProgress(() => now);
  p.update('account');
  now += 2000;
  p.update('mailbox');
  now += 3000;
  expect(p.snapshot()).toEqual({
    stage: 'mailbox',
    elapsedSeconds: 5,
    stageSeconds: 3,
    steps: ['account', 'mailbox'],
  });
  p.update('mailbox');
  expect(p.snapshot()?.steps).toEqual(['account', 'mailbox']);
  for (let i = 0; i < 20; i++) p.update(i % 2 ? 'decoding' : 'fetching');
  expect(p.snapshot()?.steps).toHaveLength(12);
  p.reset();
  expect(p.snapshot()).toBeUndefined();
});

it('freezes elapsed diagnostics after a request finishes', () => {
  let now = 1000;
  const p = createProgress(() => now);
  p.update('filling');
  now += 1000;
  p.freeze();
  now += 72000;
  expect(p.snapshot()?.elapsedSeconds).toBe(1);
  p.reset();
  expect(p.snapshot()).toBeUndefined();
});

it.each([
  ['messages-ambiguous', 'messages'],
  ['codes-ambiguous', 'codes'],
  ['requests-ambiguous', 'requests'],
  ['retrieval-incomplete', 'incomplete'],
] as const)(
  'identifies %s without exposing mail, counts or codes',
  async (stage, scenario) => {
    const t = setup();
    const progress: string[] = [];
    t.adapter.progress = (value) => progress.push(value);
    if (scenario === 'messages')
      t.adapter.retrieve = async () => [
        t.envelope,
        { ...t.envelope, messageId: 'other' },
      ];
    if (scenario === 'codes')
      t.envelope.email.text += '\nYour verification code is 008417';
    if (scenario === 'incomplete') t.adapter.retrieve = async () => null;
    const coordinator = createCoordinator(t.adapter);
    try {
      expect(
        await coordinator.handle(
          { ...t.detect, groupCount: scenario === 'requests' ? 2 : 1 },
          {},
        ),
      ).toEqual({ state: 'UNKNOWN', reason: 'ambiguity' });
      expect(progress.at(-1)).toBe(stage);
      expect(t.sent).toEqual([]);
    } finally {
      coordinator.dispose();
    }
  },
);

it.each([
  '© 2026 Example',
  'Copyright 2026 Example',
  'Copyright (c) 2020–2026 Example',
])(
  'does not interpret an explicitly marked inline copyright year as another code: %s',
  (footer) => {
    const email = {
      subject: 'Login code',
      text: 'Your code is 003719. ' + footer,
    };
    expect(parseGenericCode(email)).toMatchObject({
      status: 'candidate',
      candidate: { code: '003719' },
    });
    expect(
      parseGenericCode({ ...email, text: email.text + '. Your code is 008417' })
        .status,
    ).toBe('ambiguous');
    expect(
      parseGenericCode({ subject: 'Login code', text: 'Your code is 2026' }),
    ).toMatchObject({ status: 'candidate', candidate: { code: '2026' } });
  },
);

it.each([
  'This code was requested from 192.0.2.10, Example City at 05 October 2026, 17:15 UTC. If you did not make this request, ignore this email.',
  'This code was requested from\n192.0.2.10, Example City at\n05 October 2026, 17:15 UTC.',
])('keeps request audit metadata out of candidates: %s', (metadata) => {
  const email = {
    subject: 'Verification code',
    text:
      'Verification code\nEnter the following verification code when prompted:\n003719\nTo protect your account, do not share this code.\nDid not request this?\n' +
      metadata +
      '\n© 2026 Example',
  };
  expect(parseGenericCode(email)).toMatchObject({
    status: 'candidate',
    candidate: { code: '003719' },
  });
  expect(
    parseGenericCode({
      ...email,
      text: email.text + '\nYour verification code is 008417',
    }).status,
  ).toBe('ambiguous');
});

it('preserves two labelled codes even when the first is followed by request metadata', () => {
  expect(
    parseGenericCode({
      subject: 'Verification code',
      text: 'Your code is 003719\nThis code was requested from 192.0.2.10 at 05 October 2026. Your code is 008417',
    }).status,
  ).toBe('ambiguous');
});

it('extracts a code from inert HTML while excluding a request audit date', () => {
  const email = normalizeRawEmail(
    fixture({
      headers: [
        'Subject: Verification code',
        'Content-Type: text/html; charset=utf-8',
      ],
      body: '<h2>Verification code</h2><p>Enter the following verification code when prompted:</p><strong>003719</strong><p>To protect your account, do not share this code.</p><h3>Did not request this?</h3><p>This code was requested from <b>192.0.2.10, Example City at 05 October 2026, 17:15 UTC.</b> If you did not make this request, ignore this email.</p><footer>© 2026 Example</footer>',
    }).raw,
    true,
  );
  expect(email).not.toBeNull();
  expect(parseGenericCode(email!)).toMatchObject({
    status: 'candidate',
    candidate: { code: '003719' },
  });
});
it.each(['A7b9Q2', 'ABCDEF', 'abcdef'])(
  'generic pipeline releases case-preserved %s only after Fill',
  async (code) => {
    const t = setup();
    t.envelope.email.text = `Your verification code is ${code}.`;
    let click!: (v: boolean) => void;
    t.adapter.confirm = () =>
      new Promise((resolve) => {
        click = resolve;
      });
    const coordinator = createCoordinator(t.adapter);
    const result = coordinator.handle(t.detect, {});
    await vi.waitFor(() =>
      expect(coordinator.status()).toEqual({ state: 'CANDIDATE' }),
    );
    expect(t.sent).toEqual([]);
    click(true);
    expect(await result).toEqual({ state: 'FILLED' });
    expect(t.sent).toMatchObject([
      { type: 'prepare', expectedLength: 6 },
      { type: 'release', code, expectedLength: 6 },
    ]);
    coordinator.dispose();
  },
);
it('grouped presentation reaches a six-character release only after Fill', async () => {
  const t = setup();
  t.envelope.email.subject = 'Team confirmation code: A7B-C9D';
  t.envelope.email.text = 'Here is your confirmation code.\nA7B-C9D';
  let click!: (value: boolean) => void;
  t.adapter.confirm = () =>
    new Promise((resolve) => {
      click = resolve;
    });
  const coordinator = createCoordinator(t.adapter);
  const result = coordinator.handle(t.detect, {});
  await vi.waitFor(() =>
    expect(coordinator.status()).toEqual({ state: 'CANDIDATE' }),
  );
  expect(t.sent).toEqual([]);
  click(true);
  expect(await result).toEqual({ state: 'FILLED' });
  expect(t.sent).toMatchObject([
    { type: 'prepare', expectedLength: 6 },
    { type: 'release', expectedLength: 6, code: 'A7BC9D' },
  ]);
  coordinator.dispose();
});
it('starts presentation before slow admission finishes without releasing a code', async () => {
  const t = setup();
  const context = await t.adapter.context({});
  let finish!: (value: typeof context) => void;
  t.adapter.context = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const detected = vi.fn(async () => {});
  t.adapter.detected = detected;
  t.adapter.settings = () => ({ autofillEnabled: true, blockedOrigins: [] });
  t.adapter.confirm = async () => false;
  const coordinator = createCoordinator(t.adapter);
  const result = coordinator.handle(t.detect, {});
  expect(detected).toHaveBeenCalledTimes(1);
  expect(t.sent).toEqual([]);
  finish(context);
  expect(await result).toMatchObject({ state: 'CANCELLED' });
  expect(t.sent).toEqual([]);
  coordinator.dispose();
});
it.each(['manual', 'opening-refused'])(
  'early presentation preserves confirmation gates for %s',
  async (scenario) => {
    const t = setup();
    const detected = vi.fn(async () => {
      if (scenario === 'opening-refused')
        throw new Error('Synthetic popup refusal');
    });
    t.adapter.detected = detected;
    t.adapter.settings = () => ({ autofillEnabled: true, blockedOrigins: [] });
    t.adapter.confirm = async () => false;
    const coordinator = createCoordinator(t.adapter);
    expect(
      await coordinator.handle(
        { ...t.detect, manual: scenario === 'manual' },
        {},
      ),
    ).toMatchObject({ state: 'CANCELLED' });
    expect(detected).toHaveBeenCalledTimes(scenario === 'manual' ? 0 : 1);
    expect(t.sent).toEqual([]);
    coordinator.dispose();
  },
);
it.each(['already-used', 'unavailable'] as const)(
  'reports %s reservation without releasing the code',
  async (replay) => {
    const t = setup();
    t.adapter.reserve = async () => replay;
    const coordinator = createCoordinator(t.adapter);
    expect(await coordinator.handle(t.detect, {})).toEqual({
      state: 'UNKNOWN',
      reason: 'message-binding',
      replay,
    });
    expect(t.sent).toMatchObject([{ type: 'prepare' }]);
    expect(t.sent).not.toContainEqual(
      expect.objectContaining({ type: 'release' }),
    );
    coordinator.dispose();
  },
);
it('a fresh request still refuses two newly delivered plausible messages', async () => {
  const t = setup();
  t.adapter.retrieve = async () => [
    t.envelope,
    {
      ...t.envelope,
      messageId: 'second-fresh',
      email: { subject: 'Verification code', text: 'Your code is 008417' },
    },
  ];
  const coordinator = createCoordinator(t.adapter);
  expect(
    await coordinator.handle({ ...t.detect, fresh: true }, {}),
  ).toMatchObject({ state: 'UNKNOWN', reason: 'ambiguity' });
  expect(t.sent).toEqual([]);
  coordinator.dispose();
});
