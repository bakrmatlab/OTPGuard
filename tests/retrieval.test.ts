import { afterEach, expect, it, vi } from 'vitest';
import {
  boundedJson,
  createGmailTransport,
  RetrievalFailure,
} from '../apps/extension/gmail/transport';
import { createRetrievalEngine } from '../apps/extension/gmail/retrieval';
import {
  createGmailLifecycle,
  GmailUnauthorized,
} from '../apps/extension/gmail/lifecycle';
import { GMAIL_SCOPE } from '../apps/extension/gmail/config';
const context = {
  accountId: 'user',
  mailboxId: 'mailbox@fixture.invalid',
  tabId: 1,
  documentId: 'doc',
  origin: 'https://fixture.invalid',
  browserUrl: 'https://fixture.invalid/',
  policyUrl: 'https://fixture.invalid/',
  foreground: true,
  serviceId: 'synthetic',
};
afterEach(() => vi.useRealTimers());
it('fetches deduplicated bounded full bodies with safe credentials and contextual sender/time query', async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('format=full')
            ? { id: 'a' }
            : { messages: [{ id: 'a' }, { id: 'a' }] },
        ),
      ),
  );
  expect(
    await createGmailTransport(fetcher).cycle(
      'synthetic-token',
      ['sender@fixture.invalid'],
      100_000,
      new AbortController().signal,
    ),
  ).toEqual([{ id: 'a' }]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const first = vi.mocked(fetcher).mock.calls[0]![0];
  expect(new URL(first).searchParams.get('q')).toBe(
    '{from:sender@fixture.invalid} after:40 before:160',
  );
  const init = vi.mocked(fetcher).mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(init[1]).toMatchObject({
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    headers: { Authorization: 'Bearer synthetic-token' },
  });
  expect(first).not.toContain('synthetic-token');
});
it.each([
  { nextPageToken: 'more' },
  { messages: Array.from({ length: 11 }, (_, i) => ({ id: String(i) })) },
  { messages: [{ id: '../profile' }] },
])('refuses incomplete or unsafe ID sets before any body get', async (body) => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(body)));
  await expect(
    createGmailTransport(fetcher).cycle(
      'synthetic',
      ['sender@fixture.invalid'],
      100_000,
      new AbortController().signal,
    ),
  ).rejects.toBeInstanceOf(RetrievalFailure);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects mismatched message IDs and forged search operators', async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('format=full')
            ? { id: 'b' }
            : { messages: [{ id: 'a' }] },
        ),
      ),
  );
  const transport = createGmailTransport(fetcher);
  await expect(
    transport.cycle(
      'synthetic',
      ['sender@fixture.invalid'],
      100_000,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ reason: 'schema' });
  fetcher.mockClear();
  await expect(
    transport.cycle(
      'synthetic',
      ['x OR newer_than:1d'],
      100_000,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ reason: 'schema' });
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  new Response('12345'),
  new Response('{}', { headers: { 'content-length': '100' } }),
  new Response(new Uint8Array([255])),
])('bounds declared/actual bytes and fatal UTF8', async (response) => {
  await expect(boundedJson(response, 4)).rejects.toBeInstanceOf(
    RetrievalFailure,
  );
});
it('honors quota Retry-After and keeps 401 separate from retryable network failures', async () => {
  for (const [status, retry] of [
    [429, '120'],
    [403, 'invalid'],
    [503, 'Thu, 01 Jan 1970 00:02:00 GMT'],
  ] as const) {
    const transport = createGmailTransport(
      async () =>
        new Response('', { status, headers: { 'retry-after': retry } }),
      () => 100_000,
    );
    await expect(
      transport.cycle(
        'synthetic',
        ['sender@fixture.invalid'],
        100_000,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      reason: 'quota',
      retryAt: status === 429 ? 220_000 : status === 503 ? 120_000 : 160_000,
    });
  }
  await expect(
    createGmailTransport(async () => new Response('', { status: 401 })).cycle(
      'synthetic',
      ['sender@fixture.invalid'],
      100_000,
      new AbortController().signal,
    ),
  ).rejects.toBeInstanceOf(GmailUnauthorized);
});
it('polls at bounded elapsed times, coalesces identical windows and stops on success', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const cycle = vi.fn(async () => []);
  const engine = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle,
  });
  const a = engine.retrieve(context, new AbortController().signal);
  const b = engine.retrieve(context, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(42_000);
  expect(await a).toEqual([]);
  expect(await b).toEqual([]);
  expect(cycle).toHaveBeenCalledTimes(7);
});
it('cancelled subscribers cannot receive shared results and last cancellation aborts transport', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  let signal: AbortSignal | undefined;
  const engine = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle: async (_, __, abort) => {
      signal = abort;
      return new Promise(() => {});
    },
  });
  const abort = new AbortController();
  const pending = engine.retrieve(context, abort.signal);
  await vi.advanceTimersByTimeAsync(0);
  abort.abort();
  expect(await pending).toBeNull();
  expect(signal?.aborted).toBe(true);
});
it('quota beyond deadline stops and navigation/foreground invalidation prevents further cycles', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const cycle = vi.fn(async () => {
    throw new RetrievalFailure('quota', 200_000);
  });
  const engine = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle,
  });
  const pending = engine.retrieve(context, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(0);
  expect(await pending).toBeNull();
  expect(cycle).toHaveBeenCalledTimes(1);
  const current = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
  const stopped = createRetrievalEngine({ now: Date.now, current, cycle });
  const navigation = stopped.retrieve(context, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(0);
  expect(await navigation).toBeNull();
  expect(cycle).toHaveBeenCalledTimes(1);
});
it('worker-owned mail operations require explicit connection, profile and one noninteractive token retry', async () => {
  const adapter = {
    token: vi.fn(async () => ({
      token: 'synthetic',
      grantedScopes: [GMAIL_SCOPE],
    })),
    profile: vi.fn(async () => context.mailboxId),
    remove: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    revoke: vi.fn(async () => true),
  };
  const lifecycle = createGmailLifecycle(adapter, true);
  const work = vi
    .fn()
    .mockRejectedValueOnce(new GmailUnauthorized())
    .mockResolvedValueOnce([]);
  const signal = new AbortController().signal;
  expect(
    await lifecycle.withMailbox(context.mailboxId, signal, work),
  ).toBeNull();
  expect(work).not.toHaveBeenCalled();
  await lifecycle.connect();
  expect(await lifecycle.withMailbox(context.mailboxId, signal, work)).toEqual(
    [],
  );
  expect(adapter.token).toHaveBeenLastCalledWith(false);
  expect(work).toHaveBeenCalledTimes(2);
  adapter.profile.mockResolvedValue('other@fixture.invalid');
  expect(
    await lifecycle.withMailbox(context.mailboxId, signal, work),
  ).toBeNull();
  expect(lifecycle.snapshot().state).toBe('MAILBOX_CHANGED');
  expect(work).toHaveBeenCalledTimes(2);
  const restarted = createGmailLifecycle(adapter, true);
  expect(
    await restarted.withMailbox(context.mailboxId, signal, work),
  ).toBeNull();
});

it('settles a stalled cycle at deadline and retries network failure without exceeding schedule', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const stalled = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle: async () => new Promise(() => {}),
  });
  const pending = stalled.retrieve(context, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(await pending).toBeNull();
  const cycle = vi.fn(async () => {
    throw new RetrievalFailure('network');
  });
  const offline = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle,
  });
  const result = offline.retrieve(context, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(42_000);
  expect(await result).toBeNull();
  expect(cycle).toHaveBeenCalledTimes(7);
});

it('production seam cannot bypass Clerk or the empty shipped service registry', async () => {
  const { createGmailPageCoordinator } =
    await import('../apps/extension/gmail/retrieval');
  const { createAccountGate } = await import('../apps/extension/account/gate');
  const adapter = {
    token: async () => ({ token: 'synthetic', grantedScopes: [GMAIL_SCOPE] }),
    profile: async () => context.mailboxId,
    remove: async () => {},
    clear: async () => {},
    revoke: async () => true,
  };
  const mailbox = createGmailLifecycle(adapter, true);
  await mailbox.connect();
  const cycle = vi.fn(async () => []);
  const send = vi.fn(async () => true);
  const browser = {
    now: Date.now,
    id: () => 'request',
    context: async () => context,
    current: async () => true,
    send,
  };
  const message = {
    type: 'detect',
    groupId: 'fields',
    expectedLength: 6,
    groupCount: 1,
    emailFlow: true,
  };
  for (const available of [false, true]) {
    const gate = createAccountGate(async () =>
      available
        ? {
            userId: 'user',
            sessionId: 'session',
            expiresAt: Date.now() + 30_000,
            label: 'synthetic',
          }
        : null,
    );
    const coordinator = createGmailPageCoordinator(browser, gate, mailbox, {
      cycle,
    });
    expect((await coordinator.handle(message, {})).state).toBe('UNKNOWN');
    expect(cycle).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    coordinator.dispose();
    gate.invalidate();
  }
});

it('keeps surviving coalesced subscribers active and isolates different mailbox accounts', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  let finish!: (value: []) => void;
  const cycle = vi.fn(
    async () =>
      new Promise<[]>((resolve) => {
        finish = resolve;
      }),
  );
  const engine = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle,
  });
  const abort = new AbortController();
  const a = engine.retrieve(context, abort.signal);
  const b = engine.retrieve(context, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(0);
  abort.abort();
  expect(await a).toBeNull();
  finish([]);
  await vi.advanceTimersByTimeAsync(2000);
  // The surviving subscriber still owns its shared run.
  expect(cycle).toHaveBeenCalledTimes(2);
  engine.cancelAll();
  expect(await b).toBeNull();
  const immediate = vi.fn(async () => null);
  const separate = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle: immediate,
  });
  const one = separate.retrieve(context, new AbortController().signal);
  const two = separate.retrieve(
    { ...context, accountId: 'other' },
    new AbortController().signal,
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(await one).toBeNull();
  expect(await two).toBeNull();
  expect(immediate).toHaveBeenCalledTimes(2);
});
it('respects quota delay before another cycle and cancels stalled context checks', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const cycle = vi
    .fn()
    .mockRejectedValueOnce(new RetrievalFailure('quota', 110_000))
    .mockResolvedValue(null);
  const engine = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle,
  });
  const result = engine.retrieve(context, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(9999);
  expect(cycle).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toBeNull();
  expect(cycle).toHaveBeenCalledTimes(2);
  const abort = new AbortController();
  const blocked = createRetrievalEngine({
    now: Date.now,
    current: async () => new Promise(() => {}),
    cycle,
  });
  const pending = blocked.retrieve(context, abort.signal);
  abort.abort();
  expect(await pending).toBeNull();
});

it('disconnect drains nonabortable mail grants before cache cleanup and stale work cannot fetch', async () => {
  const adapter = {
    token: vi.fn(async () => ({
      token: 'synthetic',
      grantedScopes: [GMAIL_SCOPE],
    })),
    profile: vi.fn(async () => context.mailboxId),
    remove: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    revoke: vi.fn(async () => true),
  };
  const mailbox = createGmailLifecycle(adapter, true);
  await mailbox.connect();
  let finish!: (value: { token: string; grantedScopes: string[] }) => void;
  adapter.token.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const work = vi.fn(async () => []);
  const pending = mailbox.withMailbox(
    context.mailboxId,
    new AbortController().signal,
    work,
  );
  const disconnect = mailbox.disconnect();
  await Promise.resolve();
  expect(adapter.clear).not.toHaveBeenCalled();
  finish({ token: 'synthetic', grantedScopes: [GMAIL_SCOPE] });
  expect(await pending).toBeNull();
  expect((await disconnect).state).toBe('DISCONNECTED');
  expect(work).not.toHaveBeenCalled();
  expect(adapter.clear).toHaveBeenCalledTimes(1);
});

it('keeps polling an initially empty mailbox until a code arrives after thirty seconds', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const arrived = [
    { messageId: 'synthetic-delayed' },
  ] as unknown as import('../apps/extension/pipeline/coordinator').Envelope[];
  const times: number[] = [];
  const cycle = vi.fn(async () => {
    times.push(Date.now() - 100_000);
    return Date.now() >= 130_000 ? arrived : [];
  });
  const engine = createRetrievalEngine({
    now: Date.now,
    current: async () => true,
    cycle,
  });
  const pending = engine.retrieve(context, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(35_000);
  expect(await pending).toEqual(arrived);
  expect(times).toEqual([0, 2000, 6000, 12000, 22000, 32000]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(cycle).toHaveBeenCalledTimes(6);
});
