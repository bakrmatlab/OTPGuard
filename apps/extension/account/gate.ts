export interface AccountIdentity {
  userId: string;
  sessionId: string;
  expiresAt: number;
  label: string;
}
export interface AccountBinding {
  userId: string;
  sessionId: string;
  generation: number;
}
/** Only the trusted worker supplies identities. No tokens are stored or returned. */
export function createAccountGate(
  read: () => Promise<AccountIdentity | null>,
  now = Date.now,
) {
  let identity: AccountIdentity | null = null;
  let generation = 0;
  let latestRead = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const invalidate = () => {
    clearTimeout(timer);
    identity = null;
    generation++;
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    const before = generation;
    const readId = ++latestRead;
    let next: AccountIdentity | null;
    try {
      next = await read();
    } catch {
      next = null;
    }
    if (before !== generation || readId !== latestRead) return null;
    if (!next || !Number.isFinite(next.expiresAt) || next.expiresAt <= now()) {
      invalidate();
      return null;
    }
    if (
      identity &&
      (identity.userId !== next.userId || identity.sessionId !== next.sessionId)
    )
      invalidate();
    identity = next;
    clearTimeout(timer);
    timer = setTimeout(
      invalidate,
      Math.min(next.expiresAt - now(), 2_147_483_647),
    );
    return { userId: next.userId, sessionId: next.sessionId, generation };
  };
  return {
    invalidate,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    identity: () =>
      identity && identity.expiresAt > now() ? { ...identity } : null,
    async current(bound: AccountBinding) {
      const fresh = await refresh();
      return (
        !!fresh &&
        fresh.userId === bound.userId &&
        fresh.sessionId === bound.sessionId &&
        fresh.generation === bound.generation &&
        generation === bound.generation &&
        !!identity &&
        identity.expiresAt > now()
      );
    },
  };
}
export type AccountGate = ReturnType<typeof createAccountGate>;
