import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseActivity,
  ACTIVITY_LIMIT,
  LOCAL_RETENTION_MS,
} from '../packages/shared';
import { cloudActivityPolicyApproved } from '../packages/shared/activity-policy';
import { createLocalHistory } from '../apps/extension/activity/local';
import {
  createActivitySync,
  type ActivityTransport,
} from '../apps/extension/activity/sync';
import { createActivityRecorder } from '../apps/extension/activity/record';
import { createAccountGate } from '../apps/extension/account/gate';
const id = '11111111-1111-4111-8111-111111111111';
const event = {
  serviceId: null,
  action: 'FILL',
  result: 'FILLED',
  reason: 'none',
  time: 100_000,
  installationId: id,
} as const;
afterEach(() => vi.useRealTimers());
function local() {
  let stored: unknown;
  let now: number = event.time;
  const store = {
    read: async () => structuredClone(stored),
    write: vi.fn(async (value: unknown) => {
      stored = structuredClone(value);
    }),
  };
  return {
    history: createLocalHistory(store, [], () => now),
    store,
    advance: (time: number) => {
      now = time;
    },
    stored: () => stored,
    corrupt: () => {
      stored = {
        version: 1,
        events: [{ ...event, otp: 'synthetic-forbidden' }],
      };
    },
  };
}
function sync(approved = true) {
  let identity = {
    userId: 'alice',
    sessionId: 'one',
    expiresAt: Date.now() + 60_000,
    label: 'Synthetic',
  };
  const account = createAccountGate(async () => identity);
  const transport: ActivityTransport = {
    optIn: vi.fn(async () => {}),
    append: vi.fn(async () => {}),
    optOutAndDelete: vi.fn(async () => {}),
    exportHistory: vi.fn(async () => [event]),
  };
  const connect = vi.fn(async () => transport);
  const controller = createActivitySync(account, connect, [], () => approved);
  return {
    account,
    binding: { userId: 'alice', sessionId: 'one', generation: 0 },
    transport,
    connect,
    controller,
    switchAccount: () => {
      identity = { ...identity, userId: 'bob', sessionId: 'two' };
      account.invalidate();
    },
    dispose: () => {
      controller.dispose();
      account.invalidate();
    },
  };
}
describe('closed activity contract', () => {
  it('allows only shipped IDs or unknown; never copies extra data', () => {
    expect(parseActivity(event, [])).toEqual(event);
    expect(
      parseActivity(
        Object.assign(Object.create(event), {
          a: 1,
          b: 2,
          c: 3,
          d: 4,
          e: 5,
          f: 6,
        }),
        [],
      ),
    ).toBeNull();
    expect(
      parseActivity(
        { ...event, serviceId: 'https://site.fixture.invalid' },
        [],
      ),
    ).toBeNull();
    expect(
      parseActivity({ ...event, serviceId: 'shipped' }, ['shipped'])?.serviceId,
    ).toBe('shipped');
    for (const forbidden of [
      'hostname',
      'messageId',
      'url',
      'otpHash',
      'otp',
      'email',
      'mailboxId',
      'token',
      'text',
      'owner',
    ])
      expect(
        parseActivity({ ...event, [forbidden]: 'synthetic' }, []),
      ).toBeNull();
    for (const invalid of [
      { time: NaN },
      { time: 1.5 },
      { time: -1 },
      { result: 'ARBITRARY' },
      { reason: 'secret' },
      { result: 'ERROR' },
      { installationId: 'mailbox@fixture.invalid' },
    ])
      expect(parseActivity({ ...event, ...invalid }, [])).toBeNull();
  });
});
describe('local retention, export and deletion', () => {
  it('persists only sanitized fields across restart; expires at seven days', async () => {
    const s = local();
    await s.history.append(event);
    expect(JSON.parse(await s.history.export()).events).toEqual([event]);
    const restart = createLocalHistory(
      s.store,
      [],
      () => event.time + LOCAL_RETENTION_MS - 1,
    );
    expect(await restart.list()).toEqual([event]);
    s.advance(event.time + LOCAL_RETENTION_MS);
    expect(await s.history.list()).toEqual([]);
    expect(s.stored()).toEqual({ version: 1, events: [] });
  });
  it('bounds parallel writes and refuses future or secret-bearing events', async () => {
    const s = local();
    await Promise.all(
      Array.from({ length: ACTIVITY_LIMIT + 2 }, () => s.history.append(event)),
    );
    expect(await s.history.list()).toHaveLength(ACTIVITY_LIMIT);
    await expect(
      s.history.append({ ...event, time: event.time + 1 }),
    ).rejects.toThrow();
    await expect(
      s.history.append({ ...event, messageId: 'synthetic' }),
    ).rejects.toThrow();
  });
  it('preserves corrupt records until explicit deletion and reports write failures', async () => {
    const s = local();
    s.corrupt();
    await expect(s.history.export()).rejects.toThrow('HISTORY_UNAVAILABLE');
    expect(s.stored()).not.toEqual({ version: 1, events: [] });
    await s.history.clear();
    expect(await s.history.list()).toEqual([]);
    s.store.write.mockRejectedValueOnce(new Error('offline'));
    await expect(s.history.append(event)).rejects.toThrow();
    expect(await s.history.list()).toEqual([]);
  });
  it('recorder projects fields, replaces unknown service and isolates storage failure', async () => {
    const s = local();
    const record = createActivityRecorder(s.history, () => id, []);
    await record({
      serviceId: 'https://site.fixture.invalid',
      result: 'FILLED',
      reason: 'none',
      time: event.time,
    });
    expect(await s.history.list()).toEqual([event]);
    s.store.write.mockRejectedValueOnce(new Error('offline'));
    await expect(
      record({
        serviceId: 'unknown',
        result: 'FILLED',
        reason: 'none',
        time: event.time,
      }),
    ).resolves.toBeUndefined();
  });
});
describe('inactive cloud controller', () => {
  it('production policy cannot be enabled; opt-out sends no events or requests', async () => {
    expect(cloudActivityPolicyApproved()).toBe(false);
    const s = sync(false);
    try {
      expect(await s.controller.enable()).toBe(false);
      expect(await s.controller.upload(event, s.binding)).toBe(false);
      const defaultPolicy = createActivitySync(s.account, s.connect, []);
      try {
        expect(await defaultPolicy.enable()).toBe(false);
        expect(await defaultPolicy.upload(event, s.binding)).toBe(false);
      } finally {
        defaultPolicy.dispose();
      }
      expect(s.connect).not.toHaveBeenCalled();
    } finally {
      s.dispose();
    }
    const approved = sync();
    try {
      expect(await approved.controller.upload(event, approved.binding)).toBe(
        false,
      );
      expect(approved.connect).not.toHaveBeenCalled();
    } finally {
      approved.dispose();
    }
  });
  it('explicit hypothetical approved opt-in sends closed events; delete opts out; export rejects raw extras', async () => {
    const s = sync();
    try {
      expect(await s.controller.enable()).toBe(true);
      expect(await s.controller.upload(event, s.binding)).toBe(true);
      expect(s.transport.append).toHaveBeenCalledWith(
        event,
        expect.any(AbortSignal),
      );
      expect(JSON.parse((await s.controller.export())!).events).toEqual([
        event,
      ]);
      vi.mocked(s.transport.exportHistory).mockResolvedValueOnce([
        { ...event, otpHash: 'synthetic' },
      ]);
      expect(await s.controller.export()).toBeNull();
      expect(await s.controller.disableAndDelete()).toBe(true);
      expect(await s.controller.upload(event, s.binding)).toBe(false);
    } finally {
      s.dispose();
    }
  });
  it('refuses stale connect and in-flight delivery on account switch', async () => {
    const s = sync();
    try {
      await s.controller.enable();
      let resolve!: (value: ActivityTransport) => void;
      s.connect.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const pending = s.controller.upload(event, s.binding);
      await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
      s.switchAccount();
      resolve(s.transport);
      expect(await pending).toBe(false);
      expect(s.transport.append).not.toHaveBeenCalled();
      expect(s.controller.enabled()).toBe(false);
      expect(await s.controller.upload(event, s.binding)).toBe(false);
    } finally {
      s.dispose();
    }
  });
  it('cancels pending opt-in and never resurrects consent on opt-out', async () => {
    const s = sync();
    try {
      let done!: () => void;
      vi.mocked(s.transport.optIn).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            done = resolve;
          }),
      );
      const pending = s.controller.enable();
      await vi.waitFor(() => expect(done).toBeTypeOf('function'));
      await s.controller.disableAndDelete();
      done();
      expect(await pending).toBe(false);
      expect(s.controller.enabled()).toBe(false);
    } finally {
      s.dispose();
    }
  });
  it('rejects stale event source and disposed work, and reports failed deletion', async () => {
    const s = sync();
    try {
      await s.controller.enable();
      expect(
        await s.controller.upload(event, { ...s.binding, generation: 1 }),
      ).toBe(false);
      expect(s.transport.append).not.toHaveBeenCalled();
      vi.mocked(s.transport.optOutAndDelete).mockRejectedValueOnce(
        new Error('offline'),
      );
      expect(await s.controller.disableAndDelete()).toBe(false);
      expect(s.controller.enabled()).toBe(false);
      s.controller.dispose();
      const before = s.connect.mock.calls.length;
      expect(await s.controller.enable()).toBe(false);
      expect(await s.controller.export()).toBeNull();
      expect(await s.controller.disableAndDelete()).toBe(false);
      expect(s.connect).toHaveBeenCalledTimes(before);
    } finally {
      s.dispose();
    }
  });
  it('bounds stalled upload to ten seconds and contains delivery rejection', async () => {
    vi.useFakeTimers();
    const s = sync();
    try {
      await s.controller.enable();
      vi.mocked(s.transport.append).mockImplementationOnce(
        () => new Promise(() => {}),
      );
      const pending = s.controller.upload(event, s.binding);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toBe(false);
      vi.mocked(s.transport.append).mockRejectedValueOnce(new Error('offline'));
      expect(await s.controller.upload(event, s.binding)).toBe(false);
    } finally {
      s.dispose();
    }
  });
});
