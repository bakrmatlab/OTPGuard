/* eslint-disable no-control-regex -- Reject unsafe opaque pagination tokens. */
import { GmailUnauthorized } from './lifecycle';
import { genericRetrievalLimits as limits } from '../../../packages/security/retrieval-limits';

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
export async function boundedJson(
  response: Response,
  limit: number,
  signal?: AbortSignal,
  consume: (bytes: number) => void = () => {},
) {
  const reader = response.body?.getReader();
  if (!reader) throw new RetrievalFailure('schema');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    const declared = response.headers.get('content-length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
      throw new RetrievalFailure('limit');
    while (true) {
      const next = await abortable(() => reader.read(), signal);
      if (next.done) break;
      size += next.value.byteLength;
      consume(next.value.byteLength);
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
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
/** Detach even from a stalled transport/body implementation on cancellation. */
function abortable<T>(operation: () => Promise<T>, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) return reject(new RetrievalFailure('network'));
    const abort = () => reject(new RetrievalFailure('network'));
    signal?.addEventListener('abort', abort, { once: true });
    void Promise.resolve()
      .then(() => {
        if (signal?.aborted) throw new RetrievalFailure('network');
        return operation();
      })
      .then(
        (value) => {
          signal?.removeEventListener('abort', abort);
          resolve(value);
        },
        (error) => {
          signal?.removeEventListener('abort', abort);
          reject(error);
        },
      );
  });
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
    consume: (bytes: number) => void = () => {},
  ) => {
    const requestSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(10_000),
    ]);
    let response: Response;
    try {
      response = await abortable(
        () =>
          fetcher(url.href, {
            headers: { Authorization: 'Bearer ' + token },
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            signal: requestSignal,
          }).then((value) => {
            if (requestSignal.aborted)
              void value.body?.cancel().catch(() => {});
            return value;
          }),
        requestSignal,
      );
    } catch {
      throw new RetrievalFailure('network');
    }
    if (response.status === 401) {
      void response.body?.cancel().catch(() => {});
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
      void response.body?.cancel().catch(() => {});
      throw new RetrievalFailure(
        'quota',
        now() + (Number.isFinite(delay) ? Math.max(1000, delay) : 60_000),
      );
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new RetrievalFailure('network');
    }
    return boundedJson(response, limit, requestSignal, consume);
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
      const cancellation = new AbortController();
      const cycleSignal = AbortSignal.any([signal, cancellation.signal]);
      const timer = generic
        ? setTimeout(() => cancellation.abort(), limits.cycleMilliseconds)
        : undefined;
      let totalBytes = 0;
      const consume = (bytes: number) => {
        totalBytes += bytes;
        if (generic && totalBytes > limits.cycleBytes)
          throw new RetrievalFailure('limit');
      };
      try {
        const listIds = async () => {
          const url = new URL(base);
          url.searchParams.set('maxResults', String(limits.pageSize));
          url.searchParams.set('includeSpamTrash', String(generic));
          if (generic)
            url.searchParams.set('fields', 'messages(id),nextPageToken');
          url.searchParams.set(
            'q',
            `${generic ? '' : `{${senders.map((s) => 'from:' + s).join(' ')}} `}after:${Math.floor(notBefore / 1000)} before:${Math.ceil(until / 1000)}`,
          );
          const ids = new Set<string>();
          const tokens = new Set<string>();
          for (let page = 0; ; page++) {
            progress('listing');
            const body = await read(
              url,
              token,
              cycleSignal,
              16 * 1024,
              consume,
            );
            if (!body || typeof body !== 'object' || Array.isArray(body))
              throw new RetrievalFailure('schema');
            const list = body as {
              messages?: unknown;
              nextPageToken?: unknown;
            };
            // Truncation cannot silently remove a competing challenge.
            if (
              (!generic && list.nextPageToken !== undefined) ||
              (list.messages !== undefined && !Array.isArray(list.messages))
            )
              throw new RetrievalFailure('limit');
            const entries = (list.messages ?? []) as unknown[];
            if (entries.length > limits.pageSize)
              throw new RetrievalFailure('limit');
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
            if (ids.size > (generic ? limits.messages : 10))
              throw new RetrievalFailure('limit');
            if (list.nextPageToken === undefined) break;
            const next = list.nextPageToken;
            if (
              typeof next !== 'string' ||
              !next.length ||
              next.length > 2048 ||
              /[\u0000-\u001f\u007f]/.test(next)
            )
              throw new RetrievalFailure('schema');
            if (tokens.has(next) || page + 1 >= limits.pages)
              throw new RetrievalFailure('limit');
            tokens.add(next);
            url.searchParams.set('pageToken', next);
          }
          return ids;
        };
        const ids = await listIds();
        const orderedIds = [...ids];
        const messages: unknown[] = new Array(orderedIds.length);
        let cursor = 0;
        const worker = async () => {
          while (cursor < orderedIds.length) {
            if (cycleSignal.aborted) throw new RetrievalFailure('network');
            const index = cursor++;
            const id = orderedIds[index]!;
            const get = new URL(base + '/' + id);
            get.searchParams.set('format', format);
            if (generic && format === 'raw')
              get.searchParams.set('fields', 'id,internalDate,raw');
            progress('fetching');
            const message = await read(
              get,
              token,
              cycleSignal,
              limits.responseBytes,
              consume,
            );
            if (
              !message ||
              typeof message !== 'object' ||
              !('id' in message) ||
              message.id !== id
            )
              throw new RetrievalFailure('schema');
            messages[index] = message;
          }
        };
        await Promise.all(
          Array.from(
            {
              length: Math.min(
                orderedIds.length,
                generic ? limits.concurrency : 1,
              ),
            },
            worker,
          ),
        );
        // Gmail pagination is not an atomic snapshot. Refuse a visible set change
        // during body reads instead of returning a candidate from an older listing.
        if (generic && ids.size) {
          const closingIds = await listIds();
          if (
            closingIds.size !== ids.size ||
            [...closingIds].some((id) => !ids.has(id))
          )
            throw new RetrievalFailure('network');
        }
        if (cycleSignal.aborted) throw new RetrievalFailure('network');
        return messages;
      } finally {
        clearTimeout(timer);
        cancellation.abort();
      }
    },
  };
}
