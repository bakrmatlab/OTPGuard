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
  let sharedProbe: Promise<AccountBinding | null> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const invalidate = () => {
    clearTimeout(timer);
    sharedProbe = undefined;
    identity = null;
    generation++;
    for (const listener of listeners) listener();
  };
  const readFresh = async () => {
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
  // Concurrent worker callers share one authoritative in-flight probe. Nothing
  // is cached after it settles, and invalidation immediately detaches the probe.
  const refresh = (share = false) => {
    if (!share) return readFresh();
    if (sharedProbe) return sharedProbe;
    const probe = readFresh();
    sharedProbe = probe;
    void probe.finally(() => {
      if (sharedProbe === probe) sharedProbe = undefined;
    });
    return probe;
  };
  const matches = (bound: AccountBinding) =>
    !!identity &&
    identity.expiresAt > now() &&
    identity.userId === bound.userId &&
    identity.sessionId === bound.sessionId &&
    generation === bound.generation;
  return {
    invalidate,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    /** Local cancellation/expiry guard only; never a substitute for current's
     * authoritative provider probe at an authorization boundary. */
    matches,
    identity: () =>
      identity && identity.expiresAt > now() ? { ...identity } : null,
    async current(bound: AccountBinding) {
      let fresh = await refresh(true);
      // A newer concurrent popup read can supersede this probe without changing
      // authority. Retry once with another authoritative read; invalidation or a
      // real identity/generation change must still refuse immediately.
      if (!fresh && bound.generation === generation && identity)
        fresh = await refresh(true);
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
