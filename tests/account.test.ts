import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accountConfig,
  accountManifest,
} from '../apps/extension/account/config';
import {
  createAccountGate,
  type AccountIdentity,
} from '../apps/extension/account/gate';
import { createConnectedCoordinator } from '../apps/extension/account/connected';
import type { Adapter, Envelope } from '../apps/extension/pipeline/coordinator';

const identity = (): AccountIdentity => ({
  userId: 'synthetic-user-a',
  sessionId: 'synthetic-session-a',
  expiresAt: Date.now() + 30_000,
  label: 'Synthetic account',
});
afterEach(() => vi.useRealTimers());
describe('account session boundary', () => {
  it('invalidates bindings on expiry, logout, session replacement and user switch', async () => {
    vi.useFakeTimers();
    let next: AccountIdentity | null = identity();
    const gate = createAccountGate(async () => next);
    const cancel = vi.fn();
    gate.subscribe(cancel);
    const first = (await gate.refresh())!;
    expect(await gate.current(first)).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(cancel).toHaveBeenCalled();
    expect(await gate.current(first)).toBe(false);
    next = identity();
    const second = (await gate.refresh())!;
    next = { ...next, sessionId: 'synthetic-session-b' };
    expect(await gate.current(second)).toBe(false);
    const third = (await gate.refresh())!;
    next = { ...next, userId: 'synthetic-user-b' };
    expect(await gate.current(third)).toBe(false);
    const fourth = (await gate.refresh())!;
    next = null;
    expect(await gate.current(fourth)).toBe(false);
    gate.invalidate();
  });
  it('rejects failed freshness probes, logout during a probe, and stale concurrent reads', async () => {
    vi.useFakeTimers();
    let resolve!: (value: AccountIdentity | null) => void;
    const gate = createAccountGate(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = gate.refresh();
    gate.invalidate();
    resolve(identity());
    expect(await pending).toBeNull();
    const old = gate.refresh();
    const oldResolve = resolve;
    const latest = gate.refresh();
    resolve({ ...identity(), userId: 'synthetic-user-b' });
    expect((await latest)?.userId).toBe('synthetic-user-b');
    oldResolve(identity());
    expect(await old).toBeNull();
    expect(gate.identity()?.userId).toBe('synthetic-user-b');
    gate.invalidate();
    const offline = createAccountGate(async () => {
      throw new Error('synthetic offline');
    });
    expect(await offline.refresh()).toBeNull();
  });
  it.each(['logout', 'expiry', 'switch'] as const)(
    'cancels actual pending coordinator retrieval on %s',
    async (transition) => {
      vi.useFakeTimers();
      let next: AccountIdentity | null = identity();
      const gate = createAccountGate(async () => next);
      let finish!: (value: readonly Envelope[]) => void;
      let signal: AbortSignal | undefined;
      const send = vi.fn();
      const adapter: Adapter = {
        now: Date.now,
        id: () => 'synthetic-request',
        registry: [],
        context: async () => ({
          accountId: 'ignored-page-account',
          mailboxId: 'synthetic-mailbox',
          tabId: 1,
          documentId: 'document',
          origin: 'https://fixture.invalid',
          browserUrl: 'https://fixture.invalid/',
          policyUrl: 'https://fixture.invalid/',
          foreground: true,
          serviceId: 'unsupported',
        }),
        current: async () => true,
        retrieve: async (_, abort) => {
          signal = abort;
          return new Promise((done) => {
            finish = done;
          });
        },
        send,
      };
      const coordinator = createConnectedCoordinator(adapter, gate);
      const pending = coordinator.handle(
        {
          type: 'detect',
          groupId: 'fields',
          expectedLength: 6,
          groupCount: 1,
          emailFlow: true,
        },
        {},
      );
      for (let i = 0; i < 20 && !signal; i++) await Promise.resolve();
      expect(signal).toBeDefined();
      if (transition === 'logout') {
        next = null;
        gate.invalidate();
      }
      if (transition === 'expiry') await vi.advanceTimersByTimeAsync(30_000);
      if (transition === 'switch') {
        next = { ...identity(), userId: 'synthetic-user-b' };
        await gate.refresh();
      }
      expect(signal?.aborted).toBe(true);
      finish([]);
      expect((await pending).state).toBe('CANCELLED');
      expect(send).not.toHaveBeenCalled();
      coordinator.dispose();
      gate.invalidate();
    },
  );
  it('refuses an unconfigured or signed-out connected request before retrieval', async () => {
    const retrieve = vi.fn();
    const coordinator = createConnectedCoordinator(
      {
        context: vi.fn(),
        current: vi.fn(),
        retrieve,
        send: vi.fn(),
        now: Date.now,
        id: () => 'id',
        registry: [],
      },
      createAccountGate(async () => null),
    );
    expect(
      (
        await coordinator.handle(
          {
            type: 'detect',
            groupId: 'fields',
            expectedLength: 6,
            groupCount: 1,
            emailFlow: true,
          },
          {},
        )
      ).state,
    ).toBe('UNKNOWN');
    expect(retrieve).not.toHaveBeenCalled();
    coordinator.dispose();
  });
});

describe('narrow auth configuration', () => {
  const values = {
    key: 'pk_live_' + btoa('auth.fixture.invalid$'),
    frontendApi: 'https://auth.fixture.invalid',
    syncHost: 'https://auth.fixture.invalid',
    webOrigin: 'https://app.fixture.invalid',
  };
  it('adds only SDK permissions and exact API access with bundled scripts', () => {
    expect(accountConfig({})).toBeNull();
    expect(accountManifest(null).host_permissions).toEqual([]);
    expect(accountManifest(accountConfig(values))).toEqual({
      permissions: ['cookies', 'storage'],
      host_permissions: ['https://auth.fixture.invalid/*'],
      content_security_policy: {
        extension_pages:
          "script-src 'self'; object-src 'none'; connect-src https://auth.fixture.invalid;",
      },
    });
  });
  it('rejects development URL-token transport, partial settings, broad hosts and unrelated keys', () => {
    expect(() =>
      accountConfig({
        ...values,
        key: 'pk_test_' + btoa('auth.fixture.invalid$'),
      }),
    ).toThrow();
    expect(() => accountConfig({ key: values.key })).toThrow();
    for (const host of [
      'http://localhost',
      'https://127.0.0.1',
      'https://host.localhost',
      'https://auth.fixture.invalid.',
      'https://*.fixture.invalid',
      'https://auth.fixture.invalid:8443',
      'https://user@auth.fixture.invalid',
      'https://auth.fixture.invalid/path',
      'https://auth.fixture.invalid/?session=bad',
    ])
      expect(() => accountConfig({ ...values, syncHost: host })).toThrow();
    expect(() =>
      accountConfig({
        ...values,
        key: 'pk_live_' + btoa('other.fixture.invalid$'),
      }),
    ).toThrow();
  });
});
