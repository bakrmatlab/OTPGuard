import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createNativeAuth,
  nativeOrigin,
} from '../development/native-auth/client';
import { authProviders } from '../convex/authPolicy';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import schema from '../convex/schema';

const origin = 'https://synthetic.clerk.accounts.dev';
const session = () => ({
  id: 'sess_test',
  status: 'active',
  expire_at: Date.now() + 60_000,
  user: { id: 'user_test' },
});
const first = {
  id: 'sia_test',
  status: 'needs_first_factor',
  supported_first_factors: [
    { strategy: 'password' },
    { strategy: 'email_code', email_address_id: 'idn_test' },
  ],
};
function harness() {
  let current = session();
  let active = 'sess_test';
  let rejected = false;
  let second = false;
  const calls: { url: string; options: RequestInit }[] = [];
  const fetcher = vi.fn(
    async (input: string | URL | Request, options?: RequestInit) => {
      const url = String(input);
      calls.push({ url, options: options! });
      if (rejected) return new Response('{}', { status: 401 });
      const path = new URL(url).pathname;
      let value: unknown = { response: current };
      if (path === '/v1/client')
        value = {
          response: { object: 'client', last_active_session_id: active },
        };
      if (path.endsWith('/sign_ins') || path.endsWith('/prepare_first_factor'))
        value = { response: first };
      if (path.includes('/attempt_'))
        value = {
          response:
            second && path.endsWith('first_factor')
              ? {
                  id: 'sia_test',
                  status: 'needs_second_factor',
                  supported_second_factors: [{ strategy: 'totp' }],
                }
              : {
                  id: 'sia_test',
                  status: 'complete',
                  created_session_id: 'sess_test',
                },
        };
      if (path.endsWith('/tokens/convex'))
        value = { jwt: 'synthetic-convex-token' };
      return new Response(JSON.stringify(value), {
        headers: { Authorization: 'synthetic-client-token' },
      });
    },
  );
  const auth = createNativeAuth(origin, fetcher);
  return {
    auth,
    fetcher,
    calls,
    revoke: () => {
      current = { ...current, status: 'revoked' };
    },
    expire: () => {
      current = { ...current, expire_at: Date.now() - 1 };
    },
    switch: () => {
      active = 'sess_other';
    },
    reject: () => {
      rejected = true;
    },
    mfa: () => {
      second = true;
    },
  };
}
afterEach(() => vi.useRealTimers());
describe('isolated native Clerk transport', () => {
  it('maps only safe provider error codes and discards private messages and causes', async () => {
    const auth = createNativeAuth(
      origin,
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              errors: [
                {
                  code: 'form_password_length_too_short',
                  message: 'synthetic private credential',
                  meta: { value: 'synthetic private credential' },
                },
              ],
            }),
            { status: 422 },
          ),
      ),
    );
    const error = await auth
      .register('synthetic@example.invalid', 'short')
      .catch((error) => error as unknown);
    expect(error).toMatchObject({ message: 'PASSWORD_TOO_SHORT' });
    expect(error).not.toHaveProperty('cause');
    expect(auth.gate.identity()).toBeNull();
  });
  it('registers through native email verification only and refuses missing provider requirements', async () => {
    let missing: string[] = [];
    const pending = () => ({
      id: 'sua_test',
      status: 'missing_requirements',
      missing_fields: missing,
      unverified_fields: ['email_address'],
    });
    const paths: string[] = [];
    const auth = createNativeAuth(
      origin,
      vi.fn(async (input, options) => {
        const path = new URL(String(input)).pathname;
        paths.push(path);
        let response: unknown = pending();
        if (path === '/v1/client')
          response = { last_active_session_id: 'sess_test' };
        if (path.endsWith('/attempt_verification'))
          response = {
            id: 'sua_test',
            status: 'complete',
            created_session_id: 'sess_test',
          };
        if (path.includes('/sessions/')) response = session();
        if (path.endsWith('/sign_ups'))
          expect(String(options?.body)).toContain(
            'password=synthetic-password',
          );
        return new Response(JSON.stringify({ response }), {
          headers: { Authorization: 'synthetic-client-token' },
        });
      }),
    );
    expect(
      await auth.register('synthetic@example.invalid', 'synthetic-password'),
    ).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(auth.gate.identity()).toBeNull();
    await auth.prepareEmail();
    expect(await auth.verify('email_code', 'synthetic-code')).toBe('SIGNED_IN');
    expect(paths).toContain(
      '/v1/client/sign_ups/sua_test/attempt_verification',
    );
    auth.cancel();
    missing = ['legal_accepted'];
    await expect(
      auth.register('synthetic@example.invalid', 'synthetic-password'),
    ).rejects.toThrow('UNSUPPORTED_FACTOR');
    expect(auth.gate.identity()).toBeNull();
  });
  it('signs in, prepares email, checks authoritative identity before/after Convex and ends its session', async () => {
    const h = harness();
    expect(await h.auth.start('synthetic@example.invalid')).toBe(
      'FIRST_FACTOR_REQUIRED',
    );
    await h.auth.prepareEmail();
    expect(await h.auth.verify('email_code', 'synthetic-code')).toBe(
      'SIGNED_IN',
    );
    const consume = vi.fn(async (token, user) => {
      expect(token).toBe('synthetic-convex-token');
      expect(user).toBe('user_test');
      return 'ok';
    });
    expect(await h.auth.withConvexToken(consume)).toBe('ok');
    expect(await h.auth.signOut()).toBe('SIGNED_OUT');
    expect(h.auth.gate.identity()).toBeNull();
    expect(h.calls.some((x) => x.url.includes('/end?'))).toBe(true);
    for (const { url, options } of h.calls) {
      expect(new URL(url).search).toBe('?_is_native=1');
      expect(url).not.toMatch(
        /synthetic-(client|convex)-token|synthetic-code|example.invalid/,
      );
      expect(options).toMatchObject({
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    }
    expect(h.calls[1]!.options.headers).toMatchObject({
      Authorization: 'synthetic-client-token',
    });
    expect(
      String(
        h.calls.find((x) => x.url.includes('/attempt_first_factor'))!.options
          .body,
      ),
    ).toContain('code=synthetic-code');
  });
  it('requires supported MFA before giving session authority and rejects unsupported factors', async () => {
    const h = harness();
    h.mfa();
    await h.auth.start('synthetic@example.invalid');
    expect(await h.auth.verify('password', 'synthetic-password')).toBe(
      'SECOND_FACTOR_REQUIRED',
    );
    expect(h.auth.gate.identity()).toBeNull();
    expect(await h.auth.verify('totp', 'synthetic-code')).toBe('SIGNED_IN');
    await expect(h.auth.verify('backup_code', 'unsupported')).rejects.toThrow();
    h.auth.cancel();
  });
  it.each(['revoke', 'switch', 'reject', 'expire'] as const)(
    'refuses Convex token use after authoritative %s',
    async (change) => {
      const h = harness();
      await h.auth.start('synthetic@example.invalid');
      await h.auth.verify('password', 'synthetic-password');
      h[change]();
      const consume = vi.fn();
      await expect(h.auth.withConvexToken(consume)).rejects.toThrow();
      expect(consume).not.toHaveBeenCalled();
      expect(h.auth.gate.identity()).toBeNull();
      h.auth.cancel();
    },
  );
  it('invalidates late bootstrap/credential rotation after cancellation', async () => {
    let finish!: (response: Response) => void;
    const auth = createNativeAuth(
      origin,
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const start = auth.start('synthetic@example.invalid');
    auth.cancel();
    finish(
      new Response(JSON.stringify({ response: first }), {
        headers: { Authorization: 'late-token' },
      }),
    );
    await expect(start).rejects.toThrow();
    expect(await auth.status()).toBe('SIGN_IN_REQUIRED');
  });
  it('rejects late Convex results after logout and never restores a session', async () => {
    const h = harness();
    await h.auth.start('synthetic@example.invalid');
    await h.auth.verify('password', 'synthetic-password');
    let finish!: () => void;
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const result = h.auth.withConvexToken(async () => {
      entered();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return 'late';
    });
    await ready;
    const logout = h.auth.signOut();
    finish();
    await expect(result).rejects.toThrow();
    expect(await logout).toBe('SIGNED_OUT');
    expect(h.calls.some((x) => x.url.includes('/end?'))).toBe(true);
    expect(h.auth.gate.identity()).toBeNull();
    expect(await h.auth.status()).toBe('SIGN_IN_REQUIRED');
  });
  it('restart has no credential fallback, redirects/network errors and oversized responses fail closed', async () => {
    const h = harness();
    expect(await h.auth.status()).toBe('SIGN_IN_REQUIRED');
    expect(h.fetcher).not.toHaveBeenCalled();
    for (const fetcher of [
      vi.fn(async () => {
        throw new Error('private provider detail');
      }),
      vi.fn(async () => new Response('x'.repeat(256 * 1024 + 1))),
    ]) {
      const auth = createNativeAuth(origin, fetcher);
      await expect(auth.start('synthetic@example.invalid')).rejects.toThrow(
        'AUTH_UNAVAILABLE',
      );
      expect(auth.gate.identity()).toBeNull();
    }
  });
  it('rejects arbitrary origins and keeps production issuer policy closed', () => {
    for (const bad of [
      'http://synthetic.clerk.accounts.dev',
      origin + '/path',
      origin + '?jwt=secret',
      'https://evil.example',
      'https://synthetic.clerk.accounts.dev:444',
    ])
      expect(() => nativeOrigin(bad)).toThrow();
    expect(authProviders()).toEqual({ providers: [] });
    expect(() => authProviders(origin)).toThrow('Production');
    expect(() =>
      authProviders(
        origin,
        'native-development',
        'https://production.convex.cloud',
      ),
    ).toThrow();
    expect(
      authProviders(
        origin,
        'native-development',
        'https://academic-grouse-256.convex.cloud',
      ).providers,
    ).toHaveLength(1);
  });
});
it('Convex probe rejects anonymous callers and derives subject from validated identity', async () => {
  const t = convexTest(schema, {
    '../convex/_generated/server.ts': () =>
      import('../convex/_generated/server'),
    '../convex/authProbe.ts': () => import('../convex/authProbe'),
  });
  const query = makeFunctionReference<'query', Record<string, never>, string>(
    'authProbe:subject',
  );
  await expect(t.query(query, {})).rejects.toThrow('AUTH_REQUIRED');
  expect(await t.withIdentity({ subject: 'user_test' }).query(query, {})).toBe(
    'user_test',
  );
});
