import { describe, expect, it, vi } from 'vitest';
import {
  normalizeGmailMessage,
  gmailNormalizationLimits,
  parseVerificationCode,
} from '../packages/otp';
import { syntheticGmail } from './fixtures/email/gmail';

const normalized = (input: unknown) => {
  const result = normalizeGmailMessage(input);
  expect(result.status).toBe('normalized');
  if (result.status !== 'normalized')
    throw new Error('Synthetic fixture rejected');
  return result.message;
};
const rejected = (input: unknown, reason?: string) => {
  const result = normalizeGmailMessage(input);
  expect(result.status).toBe('rejected');
  if (reason) expect(result).toEqual({ status: 'rejected', reason });
};
const alternative = (texts: string[]) => {
  const root = syntheticGmail();
  return {
    ...root,
    payload: {
      mimeType: 'multipart/alternative',
      filename: '',
      headers: root.payload.headers.filter((h) => h.name !== 'Content-Type'),
      body: { size: 0 },
      parts: texts.map((text, i) => {
        const part = syntheticGmail(
          text,
          i ? 'text/html' : 'text/plain',
        ).payload;
        return {
          ...part,
          headers: part.headers.filter((h) => h.name === 'Content-Type'),
        };
      }),
    },
  };
};

describe('bounded Gmail full payload normalization (synthetic only)', () => {
  it('preserves leading zeros and separates provider date from SMTP receipt trust', () => {
    const message = normalized(syntheticGmail());
    expect(parseVerificationCode(message.email)).toMatchObject({
      status: 'candidate',
      candidate: { code: '003719' },
    });
    expect(message.receipt).toEqual({
      status: 'unverified',
      internalDate: 995000,
    });
    expect(message.headers.find((h) => h.name === 'date')?.value).toContain(
      '1970',
    );
  });
  it('normalizes CRLF and legal folded headers', () => {
    const input = syntheticGmail('Login code:\r\n003719');
    input.payload.headers[0]!.value = 'Sign in\r\n to Synthetic Lantern';
    expect(normalized(input).email).toEqual({
      subject: 'Sign in to Synthetic Lantern',
      text: 'Login code:\n003719',
    });
  });
  it('extracts inert text and entities without network or DOM', () => {
    const fetch = vi.fn(() => {
      throw new Error('Unexpected resource');
    });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('document', undefined);
    try {
      const message = normalized(
        syntheticGmail(
          '<html><body><p>Login code: &#48;03719</p><img src="https://remote.example/pixel"><a href="javascript:alert(1)">Sign in</a></body></html>',
          'text/html',
        ),
      );
      expect(message.email.text).toBe('Login code: 003719\nSign in');
      expect(fetch).not.toHaveBeenCalled();
      expect(parseVerificationCode(message.email).status).toBe('candidate');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it.each([
    '<script>alert(1)</script>',
    '<style>p{display:none}</style>',
    '<iframe src="https://remote.example"></iframe>',
    '<svg></svg>',
    '<blockquote>Login code: 003719</blockquote>',
    '<p hidden>Login code: 003719</p>',
    '<p style="display:none">Login code: 003719</p>',
    '<p class="gmail_quote">Login code: 003719</p>',
    '<p onclick="alert(1)">Login code: 003719</p>',
    '<img alt="003719">',
  ])('refuses active, hidden or quote-prone HTML %s', (html) =>
    rejected(syntheticGmail(html, 'text/html'), 'unsupported'),
  );
  it.each([
    '<p>Login code: 003719',
    '<p>Login code: 003719</div>',
    '<p',
    '<p x=unquoted>Login code: 003719</p>',
    '<p>Login code: &#0;</p>',
    '<p>Login code: &#xD800;</p>',
  ])('rejects malformed HTML %s', (html) =>
    rejected(syntheticGmail(html, 'text/html')),
  );
  it.each([
    '<p>Login code: &unknown;</p>',
    '<p>Login code: &#48</p>',
    '<!-- Login code: 008417 --><p>Login code: 003719</p>',
  ])(
    'refuses unsupported entities/comments instead of discarding codes',
    (html) => rejected(syntheticGmail(html, 'text/html'), 'unsupported'),
  );
  it('retains ambiguity instead of stripping another code or quoted purpose', () => {
    const message = normalized(
      syntheticGmail(
        '<p>Login code: 003719</p><p>Login code: 008417</p>',
        'text/html',
      ),
    );
    expect(parseVerificationCode(message.email).status).toBe('ambiguous');
    rejected(
      syntheticGmail('<p>&gt; Login code: 003719</p>', 'text/html'),
      'delivery',
    );
  });
  it('accepts equivalent alternatives and refuses conflicting/extra bodies', () => {
    expect(
      normalized(
        alternative(['Login code: 003719', '<p>Login code: 003719</p>']),
      ).email.text,
    ).toBe('Login code: 003719');
    rejected(
      alternative(['Login code: 003719', '<p>Login code: 008417</p>']),
      'alternatives',
    );
    rejected(
      alternative([
        'Login code: 003719',
        '<p>Login code: 003719</p><p>Another challenge</p>',
      ]),
      'alternatives',
    );
  });
  it('decodes correct padding and rejects invalid alphabet, padding and pad bits', () => {
    // Use a known one-byte canonical padded encoding separately.
    const single = syntheticGmail('A');
    single.payload.body.data = 'QQ==';
    expect(normalized(single).email.text).toBe('A');
    for (const data of [
      'A',
      'QQ=',
      'QQ===',
      'QR',
      'Q Q',
      'QQ+',
      'QQ/',
      'QQ==x',
      '=QQ=',
      'QQ\n',
    ]) {
      const malformed = syntheticGmail('A');
      malformed.payload.body.data = data;
      rejected(malformed, 'malformed');
    }
  });
  it.each(['utf-8', 'us-ascii', 'iso-8859-1'])(
    'supports explicit %s charset',
    (charset) =>
      expect(
        normalized(syntheticGmail('Login code: 003719', 'text/plain', charset))
          .email.text,
      ).toBe('Login code: 003719'),
  );
  it('preserves Latin-1 and rejects invalid UTF8/ASCII and unsupported charsets', () => {
    expect(
      normalized(
        syntheticGmail('Café\nLogin code: 003719', 'text/plain', 'iso-8859-1'),
      ).email.text,
    ).toContain('Café');
    const bad = syntheticGmail();
    bad.payload.body = {
      size: 2,
      data: Buffer.from([0xc0, 0xaf]).toString('base64url'),
    };
    rejected(bad, 'malformed');
    rejected(syntheticGmail('é', 'text/plain', 'us-ascii'), 'malformed');
    rejected(
      syntheticGmail('code', 'text/plain', 'windows-1252'),
      'unsupported',
    );
  });
  it.each(['\u0000', '\u202e', '\u200b', '\ufeff'])(
    'refuses concealed/control text %s',
    (control) =>
      rejected(syntheticGmail(`Login code: 003${control}719`), 'unsupported'),
  );
  it('never decodes MIME transfer encoding a second time', () => {
    const input = syntheticGmail('Login code: 003719');
    input.payload.headers.push({
      name: 'Content-Transfer-Encoding',
      value: 'quoted-printable',
    });
    expect(normalized(input).email.text).toBe('Login code: 003719');
    const literal = normalized(
      syntheticGmail('Login code: =30=30=33=37=31=39'),
    );
    expect(parseVerificationCode(literal.email).status).toBe('rejected');
  });
  it.each([
    'message/rfc822',
    'multipart/mixed',
    'multipart/related',
    'application/octet-stream',
    'text/calendar',
  ])('refuses unsupported/encapsulated MIME %s', (mime) =>
    rejected(syntheticGmail('Login code: 003719', mime), 'unsupported'),
  );
  it('refuses attachments, externally stored bodies and forwarding/reply markers', () => {
    const attached = syntheticGmail();
    attached.payload.filename = 'forwarded.eml';
    rejected(attached, 'delivery');
    const external = syntheticGmail();
    rejected(
      {
        ...external,
        payload: {
          ...external.payload,
          body: { size: 1, attachmentId: 'synthetic-attachment' },
        },
      },
      'delivery',
    );
    for (const name of [
      'Resent-From',
      'X-Forwarded-To',
      'In-Reply-To',
      'References',
    ]) {
      const input = syntheticGmail();
      input.payload.headers.push({ name, value: 'synthetic' });
      rejected(input, 'delivery');
    }
    for (const text of [
      '> Login code: 003719',
      '---------- Forwarded message ----------\nLogin code: 003719',
      'On yesterday wrote:\nLogin code: 003719',
    ])
      rejected(syntheticGmail(text), 'delivery');
  });
  it.each([
    '-1',
    '1e3',
    '001',
    'NaN',
    '9007199254740992',
    ' 995000',
    '995000.0',
  ])('refuses invalid internalDate %s', (internalDate) =>
    rejected({ ...syntheticGmail(), internalDate }, 'malformed'),
  );
  it('refuses malformed JSON/header/schema without throwing or returning content', () => {
    for (const input of [
      null,
      [],
      {},
      { ...syntheticGmail(), id: '../other' },
      { ...syntheticGmail(), sizeEstimate: -1 },
    ])
      rejected(input, 'malformed');
    const duplicate = syntheticGmail();
    duplicate.payload.headers.push(duplicate.payload.headers[0]!);
    rejected(duplicate, 'malformed');
    const injected = syntheticGmail();
    injected.payload.headers[0]!.value += '\r\nFrom: forged@example';
    rejected(injected, 'malformed');
    const encoded = syntheticGmail();
    encoded.payload.headers[0]!.value = '=?UTF-8?B?U2lnbiBpbg==?=';
    rejected(encoded, 'unsupported');
    const mismatch = syntheticGmail();
    mismatch.payload.body.size++;
    rejected(mismatch, 'malformed');
    const mimeMismatch = syntheticGmail();
    mimeMismatch.payload.headers.at(-1)!.value = 'text/html';
    rejected(mimeMismatch, 'unsupported');
  });
  it('caps estimates, actual bytes, text, headers, part count and recursion', () => {
    rejected(
      {
        ...syntheticGmail(),
        sizeEstimate: gmailNormalizationLimits.decodedBytes + 1,
      },
      'limit',
    );
    const bytes = syntheticGmail(
      'x'.repeat(gmailNormalizationLimits.decodedBytes + 1),
    );
    bytes.sizeEstimate = 1;
    rejected(bytes, 'limit');
    rejected(
      syntheticGmail('x'.repeat(gmailNormalizationLimits.textCharacters + 1)),
      'limit',
    );
    const headers = syntheticGmail();
    headers.payload.headers.push({
      name: 'X-Large',
      value: 'x'.repeat(gmailNormalizationLimits.headerCharacters),
    });
    rejected(headers, 'limit');
    const many = syntheticGmail();
    many.payload.headers.push(
      ...Array.from({ length: 200 }, () => ({ name: 'X-Header', value: 'x' })),
    );
    rejected(many, 'limit');
    rejected(alternative(Array(65).fill('Login code: 003719')), 'limit');
    const aggregate = alternative(Array(10).fill('x'.repeat(30000)));
    aggregate.sizeEstimate = 1;
    rejected(aggregate, 'limit');
    let nested: unknown = syntheticGmail().payload;
    for (let i = 0; i < 10; i++)
      nested = {
        mimeType: 'multipart/alternative',
        filename: '',
        headers: [],
        body: { size: 0 },
        parts: [nested],
      };
    rejected({ ...syntheticGmail(), payload: nested }, 'limit');
  });
});

describe('normalizer boundary regressions', () => {
  it('rejects uppercase alternate image text and prototype entity names', () => {
    rejected(syntheticGmail('<img ALT="003719">', 'text/html'), 'unsupported');
    rejected(
      syntheticGmail('<p>&constructor;</p>', 'text/html'),
      'unsupported',
    );
    rejected(syntheticGmail('<p>&__proto__;</p>', 'text/html'), 'unsupported');
  });
  it('requires balanced charset quotes and uses ASCII when none is declared', () => {
    for (const type of [
      'text/plain; charset="utf-8',
      'text/plain; charset=utf-8"',
      'text/plain; charset=utf-8; charset=us-ascii',
    ]) {
      const input = syntheticGmail();
      input.payload.headers.at(-1)!.value = type;
      rejected(input, 'unsupported');
    }
    const ascii = syntheticGmail();
    ascii.payload.headers.at(-1)!.value = 'text/plain';
    expect(normalized(ascii).email.text).toBe('Login code: 003719');
    const unknownCharset = syntheticGmail('Café');
    unknownCharset.payload.headers.at(-1)!.value = 'text/plain';
    rejected(unknownCharset, 'malformed');
  });
  it('bounds HTML nesting and individual tokens', () => {
    rejected(
      syntheticGmail(
        '<div>'.repeat(65) + 'Login code: 003719' + '</div>'.repeat(65),
        'text/html',
      ),
      'limit',
    );
    rejected(
      syntheticGmail(
        '<a href="' + 'x'.repeat(4096) + '">Sign in</a>',
        'text/html',
      ),
      'limit',
    );
  });
  it('round trips canonical padded and unpadded UTF8 at different byte lengths', () => {
    for (let length = 1; length <= 64; length++) {
      const text = 'é'.repeat(length) + 'x';
      const input = syntheticGmail(text);
      expect(normalized(input).email.text).toBe(text);
      input.payload.body.data = Buffer.from(text)
        .toString('base64')
        .replaceAll('+', '-')
        .replaceAll('/', '_');
      expect(normalized(input).email.text).toBe(text);
    }
  });
  it('does not spend an oversized header allocation before its character check', () => {
    const input = syntheticGmail();
    input.payload.headers.push({ name: 'X-Large', value: 'é'.repeat(65537) });
    rejected(input, 'limit');
  });
});
