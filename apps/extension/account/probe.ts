import type { AccountGate } from './gate';
/** A probe proves only the current subject, never enables metadata or Gmail. */
export async function checkAccountSubject(
  gate: AccountGate,
  token: (userId: string, sessionId: string) => Promise<string | null>,
  query: (jwt: string, signal: AbortSignal) => Promise<string>,
) {
  const bound = await gate.refresh(true);
  if (!bound) return { state: 'SIGN_IN_REQUIRED' as const };
  const abort = new AbortController();
  const unsubscribe = gate.subscribe(() => abort.abort());
  try {
    const jwt = await token(bound.userId, bound.sessionId);
    if (!jwt || !(await gate.current(bound)))
      return { state: 'SIGN_IN_REQUIRED' as const };
    const subject = await query(jwt, abort.signal);
    if (!(await gate.current(bound)))
      return { state: 'SIGN_IN_REQUIRED' as const };
    if (subject !== bound.userId) {
      gate.invalidate();
      return { state: 'IDENTITY_MISMATCH' as const };
    }
    return { state: 'IDENTITY_VERIFIED' as const };
  } catch {
    gate.invalidate();
    return { state: 'IDENTITY_UNAVAILABLE' as const };
  } finally {
    unsubscribe();
    abort.abort();
  }
}
export function convexProbeOrigin(value: string | undefined) {
  if (!value) return null;
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.origin !== value ||
    url.username ||
    url.password ||
    url.port ||
    !/^[a-z0-9-]+\.convex\.cloud$/.test(url.hostname)
  )
    throw new Error('Exact Convex cloud origin required');
  return url.origin;
}
export async function querySubject(
  origin: string,
  jwt: string,
  signal?: AbortSignal,
) {
  const response = await fetch(origin + '/api/query', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + jwt,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: 'authProbe:subject',
      args: {},
      format: 'json',
    }),
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
      : AbortSignal.timeout(10_000),
  });
  if (!response.ok || !response.body) throw new Error('Probe unavailable');
  const reader = response.body.getReader();
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_384) throw new Error('Probe unavailable');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const result: unknown = JSON.parse(text);
    if (
      !result ||
      typeof result !== 'object' ||
      !('status' in result) ||
      result.status !== 'success' ||
      !('value' in result) ||
      typeof result.value !== 'string'
    )
      throw new Error('Probe unavailable');
    return result.value;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
