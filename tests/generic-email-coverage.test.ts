import { expect, it } from 'vitest';
import { normalizeRawEmail, parseGenericCode } from '../packages/otp';
const raw = (headers: string[], body: string) =>
  new TextEncoder().encode(
    headers.join('\r\n') + '\r\n\r\n' + body.replace(/\r?\n/g, '\r\n') + '\r\n',
  );
it.each([
  ['Your verification code', 'Your verification code: 003719'],
  ['Sign in', 'Use this code to log in:\n003719'],
  ['Sign in', 'Your passcode is 003719'],
  ['', 'Your verification code is 003719'],
  ['Sign in', 'Your verification code: 003 719'],
  ['Sign in', 'Your verification code: 0 0 3 7 1 9'],
])('supports common code wording/layout: %s / %s', (subject, text) => {
  expect(
    parseGenericCode(
      normalizeRawEmail(
        raw(
          [
            ...(subject ? ['Subject: ' + subject] : []),
            'Content-Type: text/plain',
          ],
          text,
        ),
        true,
      )!,
    ),
  ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
});
for (const mime of ['text/plain', 'text/html'])
  for (const encoding of ['7bit', '8bit', 'base64', 'quoted-printable']) {
    it(`supports ${mime} with ${encoding}`, () => {
      const text =
        mime === 'text/html'
          ? '<p>Your verification code is <strong>003719</strong></p><p>&copy; Example</p>'
          : 'Your verification code is 003719';
      const body =
        encoding === 'base64' ? Buffer.from(text).toString('base64') : text;
      expect(
        parseGenericCode(
          normalizeRawEmail(
            raw(
              [
                'Subject: Sign in',
                'Content-Type: ' + mime + '; charset=utf-8',
                'Content-Transfer-Encoding: ' + encoding,
              ],
              body,
            ),
            true,
          )!,
        ),
      ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
    });
  }
it.each(['multipart/related', 'multipart/mixed'])(
  'supports %s with an inert image resource',
  (mime) => {
    const body =
      '--parts\r\nContent-Type: text/plain\r\n\r\nYour code is 003719\r\n--parts\r\nContent-Type: image/png; name="logo.png"\r\nContent-Disposition: inline; filename="logo.png"\r\nContent-Transfer-Encoding: base64\r\n\r\nAAAA\r\n--parts--';
    expect(
      parseGenericCode(
        normalizeRawEmail(
          raw(
            [
              'Subject: Login code',
              'Content-Type: ' + mime + '; boundary="parts"',
            ],
            body,
          ),
          true,
        )!,
      ),
    ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
  },
);
it.each(['iso-8859-1', 'windows-1252'])(
  'supports ordinary %s text',
  (charset) => {
    const bytes = Uint8Array.from(
      Buffer.from(
        'Subject: Login code\r\nContent-Type: text/plain; charset=' +
          charset +
          '\r\nContent-Transfer-Encoding: 8bit\r\n\r\nYour code is 003719\r\nCaf\xe9\r\n',
        'latin1',
      ),
    );
    expect(parseGenericCode(normalizeRawEmail(bytes, true)!)).toMatchObject({
      status: 'candidate',
      candidate: { code: '003719' },
    });
  },
);
it('keeps different alternatives ambiguous and refuses forwarded/encrypted bodies', () => {
  const body =
    '--p\r\nContent-Type: text/plain\r\n\r\nYour code is 003719\r\n--p\r\nContent-Type: text/html\r\n\r\n<p>Your code is 008417</p>\r\n--p--';
  expect(
    parseGenericCode(
      normalizeRawEmail(
        raw(
          [
            'Subject: Login code',
            'Content-Type: multipart/alternative; boundary="p"',
          ],
          body,
        ),
        true,
      )!,
    ).status,
  ).toBe('ambiguous');
  expect(
    normalizeRawEmail(
      raw(
        ['Subject: Code', 'Content-Type: message/rfc822'],
        'Your code is 003719',
      ),
      true,
    ),
  ).toBeNull();
  expect(
    normalizeRawEmail(
      raw(['Subject: Code', 'Content-Type: multipart/encrypted'], 'ciphertext'),
      true,
    ),
  ).toBeNull();
});

it.each([
  '<p>Your code is <span>003</span><span>719</span></p>',
  '<p>Your code is</p><table><tr><td>0</td><td>0</td><td>3</td><td>7</td><td>1</td><td>9</td></tr></table>',
  '<p>Use this code to log in:</p><div>003719</div><footer>&trade;&reg;&hellip;&nbsp;2026</footer>',
])('supports styled and table-digit HTML layouts', (html) => {
  expect(
    parseGenericCode(
      normalizeRawEmail(
        raw(
          ['Subject: Sign in', 'Content-Type: text/html; charset=utf-8'],
          html,
        ),
        true,
      )!,
    ),
  ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
});
it.each(['0037', '00371', '003719', '0037194', '00371942'])(
  'preserves supported numeric lengths and zeros: %s',
  (code) => {
    expect(
      parseGenericCode({ subject: 'Your OTP', text: 'Your code is ' + code }),
    ).toMatchObject({ status: 'candidate', candidate: { code } });
  },
);
it.each([
  ['Subject: =?windows-1252?Q?Your_code_=96_003719?=', 'Your code is 003719'],
  [
    'Subject: =?UTF-8?Q?Your_verification_?=\r\n =?UTF-8?B?Y29kZSBpcyAwMDM3MTk=?=',
    '003719',
  ],
])('supports folded and legacy-encoded subjects', (subject, text) => {
  expect(
    parseGenericCode(
      normalizeRawEmail(
        raw([subject, 'Content-Type: text/plain'], text),
        true,
      )!,
    ),
  ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
});
it.each([
  ['Your verification code is 003719\nYour code is 008417', 'ambiguous'],
  ['Your code is 003719\nCopyright 2026 Example', 'candidate'],
  ['Your code is 123456789', 'rejected'],
  ['Your code is 003719\n> Your code is 008417', 'rejected'],
  ['Your password reset code is 003719', 'rejected'],
])('preserves ambiguous/unsupported refusal: %s', (text, status) => {
  expect(parseGenericCode({ subject: 'Verification code', text }).status).toBe(
    status,
  );
});

for (const container of [
  'multipart/alternative',
  'multipart/related',
  'multipart/mixed',
]) {
  for (const encoding of ['7bit', '8bit', 'base64', 'quoted-printable']) {
    it(`supports nested ${container} and ${encoding} with folded headers`, () => {
      const html =
        '<p>Your verification code is <b>003719</b></p><footer>&copy;&mdash; 2026</footer>';
      const encoded =
        encoding === 'base64'
          ? Buffer.from(html)
              .toString('base64')
              .match(/.{1,60}/g)!
              .join('\r\n')
          : encoding === 'quoted-printable'
            ? html.replace(/ /g, '=20')
            : html;
      const body =
        '--outer\r\nContent-Type: multipart/alternative; boundary=inner\r\n\r\n--inner\r\nContent-Type: text/plain\r\n\r\nYour verification code is 003719\r\n--inner\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: ' +
        encoding +
        '\r\n\r\n' +
        encoded +
        '\r\n--inner--\r\n--outer--';
      expect(
        parseGenericCode(
          normalizeRawEmail(
            raw(
              [
                'Subject: Your verification code',
                'Content-Type: ' + container + ';\r\n boundary=outer',
              ],
              body,
            ),
            true,
          )!,
        ),
      ).toMatchObject({ status: 'candidate', candidate: { code: '003719' } });
    });
  }
}
it('ignores a binary attachment while refusing email attachments and malformed boundaries', () => {
  const body =
    '--p\r\nContent-Type: text/plain\r\n\r\nYour code is 003719\r\n--p\r\nContent-Type: application/pdf; name="note.pdf"\r\nContent-Disposition: attachment; filename="note.pdf"\r\n\r\nopaque\r\n--p--';
  const headers = [
    'Subject: Code',
    'Content-Type: multipart/mixed; boundary=p',
  ];
  expect(
    parseGenericCode(normalizeRawEmail(raw(headers, body), true)!),
  ).toMatchObject({ status: 'candidate' });
  expect(
    normalizeRawEmail(
      raw(headers, body.replace('application/pdf', 'message/rfc822')),
      true,
    ),
  ).toBeNull();
  expect(
    normalizeRawEmail(raw(headers, body.replace('--p--', '')), true),
  ).toBeNull();
});

it('reports the exact decoding stage without including email contents', () => {
  const issues: string[] = [];
  const bytes = raw(
    [
      'Subject: Login code',
      'Content-Type: text/plain',
      'Content-Type: text/html',
    ],
    'Your code is 003719',
  );
  expect(
    normalizeRawEmail(bytes, true, (issue) => issues.push(issue)),
  ).toBeNull();
  expect(issues).toEqual(['duplicate-headers']);
});

it.each([
  'charset = "UTF-8"',
  'charset=utf8',
  'charset="utf-8 "',
  'charset=unicode-1-1-utf-8',
])('decodes standard UTF-8 parameter/alias %s', (parameter) => {
  let issue: string | undefined;
  const message = normalizeRawEmail(
    raw(
      [
        'Subject: Login code',
        'Content-Type: text/html; ' + parameter,
        'Content-Transfer-Encoding: 8bit',
      ],
      '<p>Your code is 003719</p><p>© Example</p>',
    ),
    true,
    (value) => {
      issue = value;
    },
  );
  expect(issue).toBeUndefined();
  expect(parseGenericCode(message!)).toMatchObject({
    status: 'candidate',
    candidate: { code: '003719' },
  });
});

it.each([
  ['utf8', '/w=='],
  ['us-ascii', 'wqk='],
  ['unknown-encoding', 'MDAzNzE5'],
])('refuses invalid bytes or unknown charset %s', (charset, body) => {
  let issue: string | undefined;
  expect(
    normalizeRawEmail(
      raw(
        [
          'Subject: Login code',
          'Content-Type: text/plain; charset=' + charset,
          'Content-Transfer-Encoding: base64',
        ],
        body,
      ),
      true,
      (value) => {
        issue = value;
      },
    ),
  ).toBeNull();
  expect(issue).toBe('charset');
});
