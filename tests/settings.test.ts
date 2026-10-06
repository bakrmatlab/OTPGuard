import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalSettings,
  parseLocal,
  canonicalBlock,
  type LocalSettings,
} from '../apps/extension/settings/local';
import {
  createSettingsSync,
  type SyncTransport,
} from '../apps/extension/settings/sync';
import {
  createAccountGate,
  type AccountIdentity,
} from '../apps/extension/account/gate';
import { parseSettings, parseReport } from '../packages/shared';
const id = '11111111-1111-4111-8111-111111111111';
function localFixture(stored: unknown = undefined) {
  let persisted = stored;
  const write = vi.fn(async (value: LocalSettings) => {
    persisted = structuredClone(value);
  });
  const store = { read: async () => persisted, write };
  const local = createLocalSettings(store, () => id);
  return { local, store, write, persisted: () => persisted };
}
function syncFixture(transport: SyncTransport | null = null) {
  const fixture = localFixture();
  let identity: AccountIdentity | null = {
    userId: 'alice',
    sessionId: 'session',
    label: 'synthetic@fixture.invalid',
    expiresAt: Date.now() + 60_000,
  };
  const account = createAccountGate(async () => identity);
  const sync = createSettingsSync(
    fixture.local,
    account,
    transport ? async () => transport : null,
  );
  return {
    ...fixture,
    account,
    sync,
    dispose() {
      sync.dispose();
      account.invalidate();
    },
    switchUser() {
      identity = { ...identity!, userId: 'bob', sessionId: 'other' };
      account.invalidate();
    },
  };
}
afterEach(() => vi.useRealTimers());
describe('local settings persistence and cloud boundary', () => {
  it('enables automatic finding on a fresh durable installation', async () => {
    const f = localFixture();
    expect(f.local.available()).toBe(false);
    expect(f.local.snapshot().autofillEnabled).toBe(false);
    await f.local.initialized;
    expect(f.local.available()).toBe(true);
    expect(f.local.snapshot().autofillEnabled).toBe(true);
    expect(f.persisted()).toMatchObject({ autofillEnabled: true });
  });
  it('preserves a previously saved opt-out across initialization', async () => {
    const stored = {
      version: 1,
      installationId: id,
      autofillEnabled: false,
      blockedOrigins: ['https://site.fixture.invalid'],
    };
    const f = localFixture(stored);
    await f.local.initialized;
    expect(f.local.snapshot()).toEqual(stored);
    expect(f.write).not.toHaveBeenCalled();
  });

  it('persists only explicit settings and an installation UUID, and restores local blocks', async () => {
    const f = localFixture();
    await f.local.initialized;
    await f.local.setAutofill(true);
    await f.local.setBlock('https://site.fixture.invalid', true);
    const restarted = createLocalSettings(f.store, () => {
      throw new Error('must retain UUID');
    });
    await restarted.initialized;
    expect(restarted.snapshot()).toEqual({
      version: 1,
      installationId: id,
      autofillEnabled: true,
      blockedOrigins: ['https://site.fixture.invalid'],
    });
    await restarted.setBlock('https://site.fixture.invalid', false);
    expect(restarted.snapshot().blockedOrigins).toEqual([]);
    const snapshot = restarted.snapshot();
    (snapshot.blockedOrigins as string[]).push(
      'https://forged.fixture.invalid',
    );
    expect(restarted.snapshot().blockedOrigins).toEqual([]);
  });
  it('serializes competing local writes without dropping blocks', async () => {
    const f = localFixture();
    await f.local.initialized;
    await Promise.all([
      f.local.setBlock('https://one.fixture.invalid', true),
      f.local.setBlock('https://two.fixture.invalid', true),
      f.local.setAutofill(true),
    ]);
    expect(f.local.snapshot().blockedOrigins).toEqual([
      'https://one.fixture.invalid',
      'https://two.fixture.invalid',
    ]);
  });
  it('fails closed on storage errors or corrupt records without overwriting blocks', async () => {
    const f = localFixture({
      version: 99,
      autofillEnabled: true,
      blockedOrigins: ['https://site.fixture.invalid'],
    });
    await f.local.initialized;
    expect(f.local.available()).toBe(false);
    expect(f.write).not.toHaveBeenCalled();
    expect(f.local.snapshot().autofillEnabled).toBe(false);
    const broken = createLocalSettings({
      read: async () => {
        throw new Error('read failed');
      },
      write: async () => {},
    });
    await broken.initialized;
    expect(broken.available()).toBe(false);
    await expect(broken.setAutofill(true)).rejects.toThrow(
      'LOCAL_SETTINGS_UNAVAILABLE',
    );
    const good = localFixture();
    await good.local.initialized;
    good.write.mockRejectedValueOnce(new Error('write failed'));
    await expect(good.local.setAutofill(false)).rejects.toThrow();
    expect(good.local.snapshot().autofillEnabled).toBe(true);
  });
  it('rejects full URLs, insecure origins and extra stored/cloud fields', () => {
    for (const origin of [
      'https://site.fixture.invalid/path',
      'https://site.fixture.invalid?secret=synthetic',
      'http://site.fixture.invalid',
      'https://user@site.fixture.invalid',
      'https://site.fixture.invalid:444',
      'https://site.fixture.invalid/',
    ])
      expect(canonicalBlock(origin)).toBeNull();
    expect(
      parseLocal({
        version: 1,
        installationId: id,
        autofillEnabled: true,
        blockedOrigins: [],
        token: 'synthetic',
      }),
    ).toBeNull();
    expect(
      parseSettings({ autofillEnabled: true, trustedDomains: [] }),
    ).toBeNull();
    expect(
      parseReport({
        installationId: id,
        providerStatus: 'CONNECTED',
        mailboxId: 'synthetic',
      }),
    ).toBeNull();
  });
  it('remains local with an unconfigured or opted-out transport', async () => {
    const transport = {
      readSettings: vi.fn(),
      writeSettings: vi.fn(),
      registerInstallation: vi.fn(),
    };
    const f = syncFixture(transport);
    await f.local.initialized;
    await f.local.setAutofill(true);
    await f.sync.synchronize('CONNECTED');
    expect(transport.readSettings).not.toHaveBeenCalled();
    expect(f.sync.settings().autofillEnabled).toBe(true);
    f.dispose();
    const unconfigured = syncFixture();
    await unconfigured.local.initialized;
    unconfigured.sync.enable(true);
    await unconfigured.sync.synchronize('CONNECTED');
    expect(unconfigured.sync.status()).toBe('UNCONFIGURED');
    unconfigured.dispose();
  });
  it('never reconnects or writes after disposal, even if enabled again', async () => {
    const transport = {
      readSettings: vi.fn(async () => ({ autofillEnabled: false })),
      writeSettings: vi.fn(async () => {}),
      registerInstallation: vi.fn(async () => {}),
    };
    const f = syncFixture(transport);
    await f.local.initialized;
    await f.local.setAutofill(true);
    f.sync.enable(true);
    f.sync.dispose();
    await f.sync.synchronize('CONNECTED', 'push');
    f.sync.enable(true);
    f.switchUser();
    await f.sync.synchronize('DISCONNECTED', 'push');
    expect(transport.registerInstallation).not.toHaveBeenCalled();
    expect(transport.writeSettings).not.toHaveBeenCalled();
    expect(transport.readSettings).not.toHaveBeenCalled();
    expect(f.sync.status()).toBe('OFF');
    expect(f.sync.settings().autofillEnabled).toBe(true);
    f.dispose();
  });
  it('cancels a pending read on disposal and discards its late preference', async () => {
    let finish!: (value: unknown) => void;
    let started!: () => void;
    const reading = new Promise<void>((resolve) => {
      started = resolve;
    });
    const transport: SyncTransport = {
      readSettings: async () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      writeSettings: vi.fn(async () => {}),
      registerInstallation: async () => {},
    };
    const f = syncFixture(transport);
    await f.local.initialized;
    await f.local.setAutofill(true);
    f.sync.enable(true);
    const pending = f.sync.synchronize('CONNECTED');
    await reading;
    f.sync.dispose();
    await pending;
    finish({ autofillEnabled: false });
    await Promise.resolve();
    expect(f.sync.status()).toBe('OFF');
    expect(f.sync.settings().autofillEnabled).toBe(true);
    expect(transport.writeSettings).not.toHaveBeenCalled();
    f.dispose();
  });
  it('round-trips only allowlisted preferences/report and local blocks always win', async () => {
    let server = { autofillEnabled: false };
    const transport = {
      readSettings: vi.fn(async () => server),
      writeSettings: vi.fn(async (value) => {
        server = value;
      }),
      registerInstallation: vi.fn<SyncTransport['registerInstallation']>(
        async () => {},
      ),
    } satisfies SyncTransport;
    const f = syncFixture(transport);
    await f.local.initialized;
    await f.local.setAutofill(true);
    await f.local.setBlock('https://site.fixture.invalid', true);
    f.sync.enable(true);
    await f.sync.synchronize('CONNECTED', 'push');
    expect(f.sync.status()).toBe('SYNCED');
    expect(f.sync.settings()).toEqual({
      autofillEnabled: true,
      blockedOrigins: ['https://site.fixture.invalid'],
    });
    expect(transport.writeSettings.mock.calls[0]![0]).toEqual({
      autofillEnabled: true,
    });
    expect(transport.registerInstallation.mock.calls[0]![0]).toEqual({
      installationId: id,
      providerStatus: 'CONNECTED',
    });
    server = { autofillEnabled: true };
    await f.local.setAutofill(false);
    await f.sync.synchronize('CONNECTED');
    expect(f.sync.settings().autofillEnabled).toBe(false);
    f.dispose();
  });
  it('outage preserves usable locally authorized settings and does not write mail/local blocks', async () => {
    const transport = {
      readSettings: vi.fn(async () => {
        throw new Error('offline');
      }),
      writeSettings: vi.fn(async () => {}),
      registerInstallation: vi.fn(async () => {}),
    };
    const f = syncFixture(transport);
    await f.local.initialized;
    await f.local.setAutofill(true);
    f.sync.enable(true);
    await f.sync.synchronize('DISCONNECTED');
    expect(f.sync.status()).toBe('UNAVAILABLE');
    expect(f.sync.settings().autofillEnabled).toBe(true);
    expect(f.write).toHaveBeenCalledTimes(2);
    f.dispose();
  });
  it('discards a stale remote response after account switch or opt-out', async () => {
    let finish!: (value: unknown) => void;
    let started!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const transport: SyncTransport = {
      readSettings: async () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      writeSettings: async () => {},
      registerInstallation: async () => {},
    };
    const f = syncFixture(transport);
    await f.local.initialized;
    await f.local.setAutofill(true);
    f.sync.enable(true);
    const pending = f.sync.synchronize('CONNECTED');
    await readStarted;
    f.switchUser();
    finish({ autofillEnabled: false });
    await pending;
    expect(f.sync.settings().autofillEnabled).toBe(true);
    expect(f.sync.status()).toBe('UNAVAILABLE');
    f.sync.enable(false);
    expect(f.sync.status()).toBe('OFF');
    f.dispose();
  });
  it('bounds stalled transport and refuses a late response', async () => {
    vi.useFakeTimers();
    let finish!: (value: unknown) => void;
    const transport: SyncTransport = {
      readSettings: async () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      writeSettings: async () => {},
      registerInstallation: async () => {},
    };
    const f = syncFixture(transport);
    await f.local.initialized;
    await f.local.setAutofill(true);
    f.sync.enable(true);
    const pending = f.sync.synchronize('CONNECTED');
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    finish({ autofillEnabled: false });
    await Promise.resolve();
    expect(f.sync.status()).toBe('UNAVAILABLE');
    expect(f.sync.settings().autofillEnabled).toBe(true);
    f.dispose();
  });
  it('rejects a response that tries to expand policy without persisting it', async () => {
    const transport: SyncTransport = {
      readSettings: async () => ({
        autofillEnabled: true,
        trustedDomains: ['https://forged.fixture.invalid'],
      }),
      writeSettings: async () => {},
      registerInstallation: async () => {},
    };
    const f = syncFixture(transport);
    await f.local.initialized;
    await f.local.setAutofill(false);
    f.sync.enable(true);
    await f.sync.synchronize('CONNECTED');
    expect(f.sync.status()).toBe('UNAVAILABLE');
    expect(f.local.snapshot().autofillEnabled).toBe(false);
    f.dispose();
  });
});

it('rejects malformed provider status before a bound transport can send it', async () => {
  const transport = {
    readSettings: vi.fn(),
    writeSettings: vi.fn(),
    registerInstallation: vi.fn(),
  };
  const f = syncFixture(transport);
  await f.local.initialized;
  f.sync.enable(true);
  await f.sync.synchronize('synthetic-invalid-status' as never);
  expect(f.sync.status()).toBe('UNAVAILABLE');
  expect(transport.registerInstallation).not.toHaveBeenCalled();
  f.dispose();
});
