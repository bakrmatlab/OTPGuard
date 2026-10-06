import {
  defaultSettings,
  installationIdPattern,
  parseSettings,
  type Settings,
} from '../../../packages/shared';
export interface LocalSettings extends Settings {
  version: 1;
  installationId: string;
  blockedOrigins: readonly string[];
}
export function canonicalBlock(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.origin === value &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
export function parseLocal(value: unknown): LocalSettings | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).length !== 4 ||
    !('version' in value) ||
    value.version !== 1 ||
    !('installationId' in value) ||
    typeof value.installationId !== 'string' ||
    !installationIdPattern.test(value.installationId) ||
    !('blockedOrigins' in value) ||
    !Array.isArray(value.blockedOrigins) ||
    value.blockedOrigins.length > 100 ||
    value.blockedOrigins.some((origin) => !canonicalBlock(origin)) ||
    !('autofillEnabled' in value)
  )
    return null;
  const settings = parseSettings({ autofillEnabled: value.autofillEnabled });
  return settings
    ? {
        ...settings,
        version: 1,
        installationId: value.installationId,
        blockedOrigins: [...new Set<string>(value.blockedOrigins)],
      }
    : null;
}
export interface LocalStore {
  read(): Promise<unknown>;
  write(value: LocalSettings): Promise<void>;
}
/** Only explicit local writes persist; synced preferences never erase local blocks. */
export function createLocalSettings(
  store: LocalStore,
  id = () => crypto.randomUUID(),
) {
  let value: LocalSettings = {
    ...defaultSettings,
    version: 1,
    installationId: '',
    blockedOrigins: [],
  };
  let ready = false;
  const listeners = new Set<() => void>();
  let queue: Promise<void> = Promise.resolve();
  const snapshot = (): LocalSettings => ({
    ...value,
    blockedOrigins: [...value.blockedOrigins],
  });
  const initialize = async () => {
    let stored: unknown;
    try {
      stored = await store.read();
    } catch {
      return;
    }
    const parsed = parseLocal(stored);
    if (parsed) {
      value = parsed;
      ready = true;
      return;
    }
    if (stored !== undefined) return;
    const fresh = parseLocal({
      ...defaultSettings,
      // New installations find codes automatically once site/provider authority
      // is granted. Existing saved preferences and unavailable storage stay intact.
      autofillEnabled: true,
      version: 1,
      installationId: id(),
      blockedOrigins: [],
    });
    if (!fresh) return;
    // Corrupt/unknown storage refuses enablement and starts with safe defaults.
    try {
      await store.write(fresh);
      value = fresh;
      ready = true;
    } catch {
      /* No usable durable installation identity. */
    }
  };
  const initialized = initialize();
  const update = (change: (current: LocalSettings) => LocalSettings) => {
    const operation = queue.then(async () => {
      await initialized;
      if (!ready) throw new Error('LOCAL_SETTINGS_UNAVAILABLE');
      const next = change(snapshot());
      await store.write(next);
      value = next;
      for (const listener of listeners) listener();
    });
    queue = operation.catch(() => {});
    return operation;
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    initialized,
    snapshot,
    available: () => ready,
    setAutofill(autofillEnabled: boolean) {
      if (typeof autofillEnabled !== 'boolean')
        return Promise.reject(new Error('INVALID_SETTINGS'));
      return update((current) => ({ ...current, autofillEnabled }));
    },
    setBlock(origin: string, blocked: boolean) {
      if (!canonicalBlock(origin) || typeof blocked !== 'boolean')
        return Promise.reject(new Error('INVALID_BLOCK'));
      return update((current) => {
        const origins = new Set(current.blockedOrigins);
        if (blocked) origins.add(origin);
        else origins.delete(origin);
        if (origins.size > 100) throw new Error('BLOCK_LIMIT');
        return { ...current, blockedOrigins: [...origins] };
      });
    },
  };
}
