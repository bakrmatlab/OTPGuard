import { afterEach, expect, it, vi } from 'vitest';
import { makeFunctionReference } from 'convex/server';
const subjectQuery = makeFunctionReference<
  'query',
  Record<string, never>,
  string
>('authProbe:subject');
import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import {
  createAccountGate,
  type AccountIdentity,
} from '../apps/extension/account/gate';
import {
  checkAccountSubject,
  convexProbeOrigin,
  querySubject,
} from '../apps/extension/account/probe';
const modules = {
  '../convex/_generated/server.ts': () => import('../convex/_generated/server'),
  '../convex/authProbe.ts': () => import('../convex/authProbe'),
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('actual read-only backend refuses anonymous identity and derives the subject', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(subjectQuery, {})).rejects.toThrow('AUTH_REQUIRED');
  expect(
    await t
      .withIdentity({
        subject: 'synthetic-user',
        issuer: 'https://clerk.fixture.invalid',
      })
      .query(subjectQuery, {}),
  ).toBe('synthetic-user');
});
it.each([
  'logout',
  'switch',
  'session',
  'expiry',
  'mismatch',
  'revoked',
] as const)(
  'refuses cloud acceptance after %s without exposing tokens',
  async (change) => {
    vi.useFakeTimers();
    let next: AccountIdentity | null = {
      userId: 'synthetic-user',
      sessionId: 'synthetic-session',
      label: 'Fixture',
      expiresAt: Date.now() + 30_000,
    };
    const gate = createAccountGate(async () => next);
    const result = await checkAccountSubject(
      gate,
      async () => 'synthetic-jwt',
      async (_jwt, signal) => {
        if (change === 'logout') {
          next = null;
          gate.invalidate();
          expect(signal.aborted).toBe(true);
        }
        if (change === 'switch') next = { ...next!, userId: 'different-user' };
        if (change === 'session')
          next = { ...next!, sessionId: 'different-session' };
        if (change === 'expiry') await vi.advanceTimersByTimeAsync(30_000);
        if (change === 'revoked') throw new Error('synthetic unauthorized');
        return change === 'mismatch' ? 'different-user' : 'synthetic-user';
      },
    );
    expect(result.state).not.toBe('IDENTITY_VERIFIED');
    expect(JSON.stringify(result)).not.toContain('jwt');
    gate.invalidate();
  },
);
it('validates a fresh matching identity and keeps the token inside the transport', async () => {
  vi.useFakeTimers();
  const gate = createAccountGate(async () => ({
    userId: 'synthetic-user',
    sessionId: 'synthetic-session',
    label: 'Fixture',
    expiresAt: Date.now() + 30_000,
  }));
  expect(
    await checkAccountSubject(
      gate,
      async () => 'synthetic-jwt',
      async () => 'synthetic-user',
    ),
  ).toEqual({ state: 'IDENTITY_VERIFIED' });
  gate.invalidate();
});
it('uses exact HTTPS Convex origins and header-only bounded query requests', async () => {
  expect(convexProbeOrigin(undefined)).toBeNull();
  for (const value of [
    'http://fixture.convex.cloud',
    'https://fixture.convex.cloud/path',
    'https://fixture.convex.cloud?jwt=x',
    'https://user@fixture.convex.cloud',
    'https://fixture.invalid',
  ])
    expect(() => convexProbeOrigin(value)).toThrow();
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ status: 'success', value: 'synthetic-user' }),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  expect(
    await querySubject('https://fixture.convex.cloud', 'synthetic-jwt'),
  ).toBe('synthetic-user');
  const [url, options] = fetcher.mock.calls[0]! as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe('https://fixture.convex.cloud/api/query');
  expect(options.headers).toEqual({
    Authorization: 'Bearer synthetic-jwt',
    'Content-Type': 'application/json',
  });
  expect(options.body).not.toContain('jwt');
  expect(options).toMatchObject({
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  fetcher.mockImplementation(async () => new Response('x'.repeat(16_385)));
  await expect(
    querySubject('https://fixture.convex.cloud', 'synthetic-jwt'),
  ).rejects.toThrow();
});
