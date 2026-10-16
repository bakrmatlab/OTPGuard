import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalSettings,
  parseLocal,
  canonicalBlock,
  type LocalSettings,
} from '../settings/local';
import { parseSettings } from '@otpguard/shared';
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
  });
});

it('rechecks website authority inside queued settings writes', async () => {
  const f = localFixture();
  await f.local.initialized;
  f.write.mockClear();
  const authorize = vi.fn(async () => false);
  await expect(f.local.setAutofill(false, authorize)).rejects.toThrow(
    'AUTHORITY_CHANGED',
  );
  await expect(
    f.local.setBlock('https://example.com', true, authorize),
  ).rejects.toThrow('AUTHORITY_CHANGED');
  expect(f.local.snapshot().autofillEnabled).toBe(true);
  expect(f.local.snapshot().blockedOrigins).toEqual([]);
  expect(f.write).not.toHaveBeenCalled();
  await f.local.setAutofill(false, async () => true);
  expect(f.local.snapshot().autofillEnabled).toBe(false);
});
