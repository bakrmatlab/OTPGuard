import { afterEach, expect, it, vi } from 'vitest';
import { createGmailTransport } from '../apps/extension/gmail/transport';
import { normalizeRawEmail, parseGenericCode } from '../packages/otp';

const cycle = (
  fetcher: (url: string, init: RequestInit) => Promise<Response>,
) =>
  createGmailTransport(fetcher).cycle(
    'synthetic',
    [],
    100000,
    new AbortController().signal,
    'raw',
    true,
  );
const json = (body: unknown) => new Response(JSON.stringify(body));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('collects every page before fetching a busy mailbox, deduplicating without trusting estimates', async () => {
  const urls: URL[] = [];
  const result = await cycle(async (url) => {
    const u = new URL(url);
    urls.push(u);
    if (u.searchParams.has('format'))
      return json({ id: u.pathname.split('/').at(-1) });
    return json(
      u.searchParams.has('pageToken')
        ? {
            messages: [
              { id: 'a' },
              ...Array.from({ length: 11 }, (_, i) => ({ id: 'b' + i })),
            ],
            resultSizeEstimate: 1,
          }
        : { messages: [{ id: 'a' }], nextPageToken: 'opaque/next+=' },
    );
  });
  expect(result).toHaveLength(12);
  expect(
    urls
      .filter((u) => !u.searchParams.has('format'))
      .every(
        (u) => u.searchParams.get('fields') === 'messages(id),nextPageToken',
      ),
  ).toBe(true);
  expect(
    urls
      .filter((u) => u.searchParams.has('format'))
      .every((u) => u.searchParams.get('fields') === 'id,internalDate,raw'),
  ).toBe(true);
  expect(urls[1]!.searchParams.get('pageToken')).toBe('opaque/next+=');
  expect(
    urls
      .slice(0, 2)
      .every((u) => u.searchParams.get('includeSpamTrash') === 'true'),
  ).toBe(true);
  expect(
    urls
      .slice(0, 2)
      .every((u) => u.searchParams.get('q') === 'after:40 before:160'),
  ).toBe(true);
});

it('uses four concurrent body reads and returns the complete set', async () => {
  let active = 0,
    peak = 0;
  const result = await cycle(async (url) => {
    const u = new URL(url);
    if (!u.searchParams.has('format'))
      return json({
        messages: Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i })),
      });
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return json({ id: u.pathname.split('/').at(-1) });
  });
  expect(result).toHaveLength(12);
  expect(peak).toBe(4);
});

it.each(['cycle', 'pages', 'ids', 'token'])(
  'refuses incomplete pagination (%s) before fetching any body',
  async (kind) => {
    let page = 0;
    const fetcher = vi.fn(async () => {
      page++;
      return json(
        kind === 'ids'
          ? {
              messages: Array.from({ length: 20 }, (_, i) => ({
                id: 'p' + page + 'm' + i,
              })),
              nextPageToken: 'p' + page,
            }
          : {
              nextPageToken:
                kind === 'token' ? '' : kind === 'cycle' ? 'same' : 'p' + page,
            },
      );
    });
    await expect(cycle(fetcher)).rejects.toMatchObject({
      reason: kind === 'token' ? 'schema' : 'limit',
    });
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(5);
  },
);

it('accepts padded/folded transfer encoding tokens without losing alternative competition', () => {
  const bytes = new TextEncoder().encode(
    'Subject: Login code\r\nContent-Type: multipart/alternative; boundary=p\r\n\r\n--p\r\nContent-Type: text/plain\r\nContent-Transfer-Encoding: base64 \r\n\r\n' +
      btoa('Your code is 003719') +
      '\r\n--p\r\nContent-Type: text/html\r\nContent-Transfer-Encoding:\r\n quoted-printable\r\n\r\n<p>Your code is 008417</p>\r\n--p--\r\n',
  );
  const email = normalizeRawEmail(bytes, true);
  expect(email).not.toBeNull();
  expect(parseGenericCode(email!).status).toBe('ambiguous');
});

it.each([49, 50, 51])(
  'enforces the complete-set cap at %s unique IDs',
  async (count) => {
    let bodies = 0;
    const result = cycle(async (url) => {
      const u = new URL(url);
      if (u.searchParams.has('format')) {
        bodies++;
        return json({ id: u.pathname.split('/').at(-1) });
      }
      const offset = Number(u.searchParams.get('pageToken') ?? 0);
      return json({
        messages: Array.from(
          { length: Math.min(20, count - offset) },
          (_, i) => ({ id: 'm' + (offset + i) }),
        ),
        ...(offset + 20 < count ? { nextPageToken: String(offset + 20) } : {}),
      });
    });
    if (count <= 50) expect(await result).toHaveLength(count);
    else await expect(result).rejects.toMatchObject({ reason: 'limit' });
    expect(bodies).toBe(count <= 50 ? count : 0);
  },
);

it('refuses a newly indexed competitor during body fetching rather than returning the first candidate', async () => {
  let listings = 0;
  await expect(
    cycle(async (url) => {
      const u = new URL(url);
      if (u.searchParams.has('format')) return json({ id: 'a' });
      return json({
        messages:
          ++listings === 1 ? [{ id: 'a' }] : [{ id: 'a' }, { id: 'late' }],
      });
    }),
  ).rejects.toMatchObject({ reason: 'network' });
  expect(listings).toBe(2);
});

it('bounds aggregate response bytes even when every message is below its individual cap', async () => {
  await expect(
    cycle(async (url) => {
      const u = new URL(url);
      if (!u.searchParams.has('format'))
        return json({
          messages: Array.from({ length: 20 }, (_, i) => ({ id: 'm' + i })),
        });
      return json({
        id: u.pathname.split('/').at(-1),
        raw: 'a'.repeat(450000),
      });
    }),
  ).rejects.toMatchObject({ reason: 'limit' });
});

it.each(['headers', 'body'])(
  'detaches a stalled %s read on cancellation and cancels all sibling reads',
  async (kind) => {
    const abort = new AbortController();
    const signals: AbortSignal[] = [];
    const fetcher = async (url: string, init: RequestInit) => {
      const u = new URL(url);
      if (!u.searchParams.has('format'))
        return json({ messages: [{ id: 'a' }, { id: 'b' }] });
      signals.push(init.signal!);
      if (signals.length === 2) queueMicrotask(() => abort.abort());
      return kind === 'headers'
        ? new Promise<Response>(() => {})
        : new Response(new ReadableStream());
    };
    await expect(
      createGmailTransport(fetcher).cycle(
        'synthetic',
        [],
        100000,
        abort.signal,
        'raw',
        true,
      ),
    ).rejects.toMatchObject({ reason: 'network' });
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  },
);

it('bounds the whole cycle, including slow pages, and never starts a body after expiry', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    return json({ nextPageToken: 'page-' + Date.now() });
  });
  const pending = expect(cycle(fetcher)).rejects.toMatchObject({
    reason: 'network',
  });
  await vi.advanceTimersByTimeAsync(30000);
  await pending;
  expect(fetcher).toHaveBeenCalledTimes(4);
  await vi.advanceTimersByTimeAsync(20000);
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it('applies the ten-second request timeout through a stalled response body', async () => {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  });
  const cancel = vi.fn();
  const fetcher = vi.fn(
    async () => new Response(new ReadableStream({ cancel })),
  );
  const pending = expect(cycle(fetcher)).rejects.toMatchObject({
    reason: 'network',
  });
  await vi.advanceTimersByTimeAsync(10000);
  await pending;
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('a failed body cancels siblings and prevents fetching the remaining queue', async () => {
  const signals: AbortSignal[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    const u = new URL(url);
    if (!u.searchParams.has('format'))
      return json({
        messages: Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i })),
      });
    signals.push(init.signal!);
    return u.pathname.endsWith('/m0')
      ? json({ id: 'wrong' })
      : new Promise<Response>(() => {});
  });
  await expect(cycle(fetcher)).rejects.toMatchObject({ reason: 'schema' });
  expect(signals).toHaveLength(4);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(5);
});
