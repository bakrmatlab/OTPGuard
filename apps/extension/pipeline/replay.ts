/** Write-ahead, nonsecret metadata only. A reservation is never rolled back, even
 * when delivery/ack is uncertain. Corrupt/unavailable storage refuses all release.
 */
export function createReleaseLedger(
  store: { read(): Promise<unknown>; write(v: unknown): Promise<void> },
  now = Date.now,
) {
  let queue = Promise.resolve();
  return {
    reserve(
      account: string,
      mailbox: string,
      message: string,
    ): Promise<boolean> {
      let result = false;
      const operation = queue.then(async () => {
        const hash = async (s: string) =>
          Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(s),
              ),
            ),
            (b) => b.toString(16).padStart(2, '0'),
          ).join('');
        const key = await hash(JSON.stringify([account, mailbox, message]));
        const raw = await store.read();
        if (
          raw !== undefined &&
          (!Array.isArray(raw) ||
            raw.length > 1000 ||
            raw.some(
              (e) =>
                !e ||
                typeof e.key !== 'string' ||
                !/^[a-f0-9]{64}$/.test(e.key) ||
                !Number.isSafeInteger(e.until),
            ))
        )
          return;
        const entries: { key: string; until: number }[] = (raw ?? []) as {
          key: string;
          until: number;
        }[];
        const live = entries.filter((e) => e.until > now());
        if (live.some((e) => e.key === key) || live.length >= 1000) return;
        live.push({ key, until: now() + 10 * 60_000 });
        await store.write(live);
        result = true;
      });
      queue = operation.catch(() => {});
      return operation.then(
        () => result,
        () => false,
      );
    },
  };
}
