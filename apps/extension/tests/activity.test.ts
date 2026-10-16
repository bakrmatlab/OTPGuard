import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseActivity,
  ACTIVITY_LIMIT,
  LOCAL_RETENTION_MS,
} from '@otpguard/shared';
import { createLocalHistory } from '../activity/local';
import { createActivityRecorder } from '../activity/record';
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

it('refuses website history deletion when authority has changed before the queued write', async () => {
  const f = local();
  await f.history.append(event);
  f.store.write.mockClear();
  await expect(f.history.clear(async () => false)).rejects.toThrow(
    'AUTHORITY_CHANGED',
  );
  expect(f.store.write).not.toHaveBeenCalled();
  expect(await f.history.list()).toEqual([event]);
  await f.history.clear(async () => true);
  expect(await f.history.list()).toEqual([]);
});
