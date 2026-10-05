import { expect, it, vi } from 'vitest';
import {
  verifyDkimPrototype,
  type DkimPrototypePolicy,
} from '../development/dkim/verify';
import { supportedServices } from '../packages/security';
import { fixture, policy, record } from './fixtures/email/dkim';
const verify = (
  raw: Uint8Array,
  override: Partial<DkimPrototypePolicy> = {},
  key = record,
) => verifyDkimPrototype(raw, { ...policy, ...override }, async () => [key]);
it.each([false, true])(
  'verifies independently signed %s canonicalization without granting receipt/replay trust',
  async (relaxed) => {
    expect(await verify(fixture({ relaxed }).raw)).toEqual({
      status: 'content-authenticated',
      receipt: 'unverified',
      replay: 'unresolved',
    });
    expect(
      supportedServices.every(
        (s) => s.evidenceContract === 'signed-content-pilot',
      ),
    ).toBe(true);
  },
);
it('preserves non-ASCII body bytes and leading-zero content through cryptographic verification', async () => {
  expect(
    (await verify(fixture({ body: 'Synthetic café code: 003719\r\n' }).raw))
      .status,
  ).toBe('content-authenticated');
});
it('accepts relaxed folding/WSP changes but refuses the same changes under simple canonicalization', async () => {
  for (const relaxed of [true, false]) {
    const raw = fixture({ relaxed })
      .raw.toString()
      .replace(
        'Subject: Synthetic login code',
        'SUBJECT:\t Synthetic\r\n\tlogin   code \t',
      );
    expect((await verify(Buffer.from(raw))).status).toBe(
      relaxed ? 'content-authenticated' : 'refused',
    );
  }
});
it.each([
  (raw: string) => raw.replace('003719', '003718'),
  (raw: string) => raw + 'Other code: 999999\r\n',
  (raw: string) => raw.replace('Synthetic login code', 'Forged login code'),
  (raw: string) => raw.replace('codes@mailer.example', 'evil@mailer.example'),
  (raw: string) => raw.replace('owner@example.test', 'other@example.test'),
  (raw: string) => raw.replace('From: ', 'From: evil@mailer.example\r\nFrom: '),
  (raw: string) => raw.replace('To: ', 'To: other@example.test\r\nTo: '),
  (raw: string) => raw.replace('Subject: ', 'Subject: Other code\r\nSubject: '),
  (raw: string) => raw.replace('d=mailer.example', 'd=attacker.example'),
  (raw: string) => raw.replace('s=test', 's=attacker'),
  (raw: string) => raw.replace('a=rsa-sha256', 'a=rsa-sha1'),
  (raw: string) => raw.replace('t=1000', 't=1'),
  (raw: string) => raw.replace('t=1000', 't=1001'),
  (raw: string) => raw.replace('t=1000;', ''),
  (raw: string) => raw.replace('h=from:to:', 'h=from:'),
  (raw: string) => raw.replace('v=1;', 'v=1; v=1;'),
  (raw: string) => raw.replace(/\r\n/g, '\n'),
])('refuses tampering or unsupported evidence %#', async (mutate) => {
  expect(
    (await verify(Buffer.from(mutate(fixture().raw.toString())))).status,
  ).toBe('refused');
});
it.each(['l=0; ', 'x=1000; ', 'x=999; ', 'i=evil@mailer.example; '])(
  'refuses signed unsafe tag %s',
  async (tags) => {
    expect((await verify(fixture({ tags }).raw)).status).toBe('refused');
  },
);
it('does not use Authentication-Results strings, including forged pass/fail pairs', async () => {
  const raw = Buffer.concat([
    Buffer.from(
      'Authentication-Results: mx.google.com; dkim=pass\r\nAuthentication-Results: mx.google.com; dkim=fail\r\n',
    ),
    fixture().raw,
  ]);
  expect((await verify(raw)).status).toBe('content-authenticated');
  expect(
    (await verify(Buffer.from(raw.toString().replace('003719', '000000'))))
      .status,
  ).toBe('refused');
});
it('demonstrates replay/import limit rather than claiming to detect it', async () => {
  const raw = fixture().raw;
  expect((await verify(raw)).status).toBe('content-authenticated');
  expect((await verify(raw.slice())).status).toBe('content-authenticated');
});
it('bounds key query to the explicit approved mapping and never passes message content', async () => {
  const resolver = vi.fn(async (name: string) => {
    expect(name).toBe('test._domainkey.mailer.example');
    return [record];
  });
  await verifyDkimPrototype(fixture().raw, policy, resolver);
  expect(resolver.mock.calls[0]?.[0]).toBe('test._domainkey.mailer.example');
  expect(resolver).toHaveBeenCalledTimes(1);
  resolver.mockClear();
  await verifyDkimPrototype(
    Buffer.from(
      fixture()
        .raw.toString()
        .replace('d=mailer.example', 'd=attacker.example'),
    ),
    policy,
    resolver,
  );
  expect(resolver).not.toHaveBeenCalled();
});
it.each([
  'v=DKIM1; p=',
  record + '; t=y',
  record + '; p=duplicate',
  record.replace('k=rsa', 'k=ed25519'),
  record + '; h=sha1',
  record + '; s=other',
])('refuses unsafe/revoked key records %#', async (key) => {
  expect((await verify(fixture().raw, {}, key)).status).toBe('refused');
});
it('refuses weak RSA keys and conflicting TXT records', async () => {
  const weak = fixture({ weak: true });
  expect((await verify(weak.raw, {}, weak.record)).status).toBe('refused');
  expect(
    (
      await verifyDkimPrototype(fixture().raw, policy, async () => [
        record,
        record,
      ])
    ).status,
  ).toBe('refused');
});
it('bounds unresolved lookup and sanitizes exceptions/results', async () => {
  vi.useFakeTimers();
  try {
    let begin: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      begin = resolve;
    });
    let aborted = false;
    const result = verifyDkimPrototype(
      fixture().raw,
      policy,
      async (_name, signal) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        begin();
        return new Promise(() => {});
      },
    );
    await started;
    await vi.advanceTimersByTimeAsync(2001);
    expect(await result).toEqual({ status: 'refused', reason: 'key' });
    expect(aborted).toBe(true);
  } finally {
    vi.useRealTimers();
  }
  const result = await verifyDkimPrototype(fixture().raw, policy, async () => {
    throw new Error('SECRET');
  });
  expect(JSON.stringify(result)).not.toMatch(/SECRET|003719|owner/);
});
it('refuses oversized inputs and invalid freshness policies', async () => {
  expect((await verify(new Uint8Array(256 * 1024 + 1))).status).toBe('refused');
  expect((await verify(fixture().raw, { maxAgeSeconds: 301 })).status).toBe(
    'refused',
  );
  expect((await verify(fixture().raw, { now: 1301000 })).status).toBe(
    'refused',
  );
});

it.each([
  { relaxed: false, body: '', canonicalBody: '\r\n' },
  { relaxed: true, body: '', canonicalBody: '' },
  { relaxed: true, body: ' \t\r\n\r\n', canonicalBody: '' },
  {
    relaxed: false,
    body: 'Synthetic code: 003719\r\n\r\n',
    canonicalBody: 'Synthetic code: 003719\r\n',
  },
  {
    relaxed: true,
    body: 'Synthetic \tcode:   003719 \t\r\n\r\n',
    canonicalBody: 'Synthetic code: 003719\r\n',
  },
])('handles RFC6376 body canonicalization %#', async (options) => {
  expect((await verify(fixture(options).raw)).status).toBe(
    'content-authenticated',
  );
});
it('refuses multiple signatures, unsigned content type and unsigned recipient headers', async () => {
  const raw = fixture().raw.toString();
  for (const changed of [
    raw.split('\r\n')[0] + '\r\n' + raw,
    raw.replace(':content-type:', ':'),
    raw.replace('h=from:to:', 'h=from:'),
  ])
    expect((await verify(Buffer.from(changed))).status).toBe('refused');
});
it('verifies the immutable byte snapshot when caller mutates its input during key resolution', async () => {
  const raw = fixture().raw;
  const result = await verifyDkimPrototype(raw, policy, async () => {
    raw.fill(0);
    return [record];
  });
  expect(result.status).toBe('content-authenticated');
  expect((await verify(raw)).status).toBe('refused');
});

it('accepts an unrelated delivery signature without trusting it or performing another key query', async () => {
  const raw = Buffer.concat([
    Buffer.from(
      'DKIM-Signature: v=1; d=delivery.example; s=other; b=ignored\r\n',
    ),
    fixture().raw,
  ]);
  const resolver = vi.fn(async () => [record]);
  expect((await verifyDkimPrototype(raw, policy, resolver)).status).toBe(
    'content-authenticated',
  );
  expect(resolver).toHaveBeenCalledTimes(1);
});
