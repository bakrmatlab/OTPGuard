import { GmailUnauthorized } from './lifecycle';

export class RetrievalFailure extends Error {
  constructor(
    readonly reason: 'quota' | 'network' | 'limit' | 'schema',
    readonly retryAt = 0,
  ) {
    super(reason);
  }
}
const base = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
/** Bounds raw bytes before JSON allocation. No error body is inspected or logged. */
export async function boundedJson(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new RetrievalFailure('schema');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    const declared = response.headers.get('content-length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
      throw new RetrievalFailure('limit');
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new RetrievalFailure('limit');
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    ) as unknown;
  } catch (error) {
    if (error instanceof RetrievalFailure) throw error;
    throw new RetrievalFailure('schema');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
/** Token supplied only by a worker-owned, profile-checked lifecycle operation. */
export function createGmailTransport(
  fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch,
  now = Date.now,
) {
  const read = async (
    url: URL,
    token: string,
    signal: AbortSignal,
    limit: number,
  ) => {
    let response: Response;
    try {
      response = await fetcher(url.href, {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      });
    } catch {
      throw new RetrievalFailure('network');
    }
    if (response.status === 401) {
      await response.body?.cancel();
      throw new GmailUnauthorized();
    }
    if (
      response.status === 429 ||
      response.status === 403 ||
      response.status === 503
    ) {
      const value = response.headers.get('retry-after');
      const delay =
        value && /^\d+$/.test(value)
          ? Number(value) * 1000
          : value
            ? Date.parse(value) - now()
            : 60_000;
      await response.body?.cancel();
      throw new RetrievalFailure(
        'quota',
        now() + (Number.isFinite(delay) ? Math.max(1000, delay) : 60_000),
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new RetrievalFailure('network');
    }
    return boundedJson(response, limit);
  };
  return {
    async cycle(
      token: string,
      senders: readonly string[],
      startedAt: number,
      signal: AbortSignal,
      format: 'full' | 'raw' = 'full',
      generic = false,
      notBefore = startedAt - 60000,
      until = startedAt + 60000,
      progress: (stage: 'listing' | 'fetching') => void = () => {},
    ) {
      if (
        (!senders.length && !generic) ||
        senders.length > 20 ||
        senders.some((s) => !/^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+$/.test(s)) ||
        !Number.isSafeInteger(startedAt) ||
        startedAt < 60_000 ||
        !Number.isSafeInteger(notBefore) ||
        notBefore < 0 ||
        !Number.isSafeInteger(until) ||
        until <= startedAt ||
        until - notBefore > 360000
      )
        throw new RetrievalFailure('schema');
      const url = new URL(base);
      url.searchParams.set('maxResults', '20');
      url.searchParams.set('includeSpamTrash', 'false');
      url.searchParams.set(
        'q',
        `${generic ? '' : `{${senders.map((s) => 'from:' + s).join(' ')}} `}after:${Math.floor(notBefore / 1000)} before:${Math.ceil(until / 1000)}`,
      );
      progress('listing');
      const body = await read(url, token, signal, 16 * 1024);
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new RetrievalFailure('schema');
      const list = body as { messages?: unknown; nextPageToken?: unknown };
      // Truncation cannot silently remove a competing challenge.
      if (
        list.nextPageToken !== undefined ||
        (list.messages !== undefined && !Array.isArray(list.messages))
      )
        throw new RetrievalFailure('limit');
      const entries = (list.messages ?? []) as unknown[];
      if (entries.length > 20) throw new RetrievalFailure('limit');
      const ids = new Set<string>();
      for (const entry of entries) {
        if (
          !entry ||
          typeof entry !== 'object' ||
          !('id' in entry) ||
          !validId(entry.id)
        )
          throw new RetrievalFailure('schema');
        ids.add(entry.id);
      }
      if (ids.size > 10) throw new RetrievalFailure('limit');
      const messages: unknown[] = [];
      for (const id of ids) {
        if (signal.aborted) throw new RetrievalFailure('network');
        const get = new URL(base + '/' + id);
        get.searchParams.set('format', format);
        progress('fetching');
        const message = await read(get, token, signal, 512 * 1024);
        if (
          !message ||
          typeof message !== 'object' ||
          !('id' in message) ||
          message.id !== id
        )
          throw new RetrievalFailure('schema');
        messages.push(message);
      }
      return messages;
    },
  };
}
