/** Signer/content verification for the owner-controlled pilot.
 * Caller owns raw-byte provenance and trusted key resolution. No receipt attestation,
 * OTP parsing, storage, logging, fetch or authorization result is produced here.
 */
export interface DkimPrototypePolicy {
  signingDomain: string;
  selector: string;
  from: string;
  recipient: string;
  now: number;
  maxAgeSeconds: number;
}
export type DkimPrototypeResult =
  | {
      status: 'content-authenticated';
      receipt: 'unverified';
      replay: 'unresolved';
    }
  | { status: 'refused'; reason: 'input' | 'signature' | 'policy' | 'key' };
export type KeyResolver = (
  name: string,
  signal: AbortSignal,
) => Promise<readonly string[]>;
const refused = (
  reason: 'input' | 'signature' | 'policy' | 'key',
): DkimPrototypeResult => ({ status: 'refused', reason });
const bytes = (value: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(value, (c) => c.charCodeAt(0));
const binary = (value: Uint8Array): string => {
  let out = '';
  for (const byte of value) out += String.fromCharCode(byte);
  return out;
};
function tags(value: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const part of value.replace(/\r\n[ \t]+/g, ' ').split(';')) {
    if (!part.trim()) continue;
    const match = /^\s*([a-z][a-z0-9_]*)\s*=([\x20-\x7e\t]*)$/.exec(part);
    if (!match || Object.hasOwn(result, match[1]!)) throw new Error();
    result[match[1]!] = match[2]!.trim();
  }
  return result;
}
function base64(value: string): Uint8Array<ArrayBuffer> {
  const compact = value.replace(/[ \t\r\n]/g, '');
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      compact,
    ) ||
    !compact
  )
    throw new Error();
  const decoded = atob(compact);
  if (btoa(decoded) !== compact) throw new Error();
  return bytes(decoded);
}
interface Header {
  name: string;
  raw: string;
  value: string;
}
function headerCanonical(header: string, relaxed: boolean): string {
  if (!relaxed) return header;
  const colon = header.indexOf(':');
  return (
    header.slice(0, colon).toLowerCase() +
    ':' +
    header
      .slice(colon + 1)
      .replace(/\r\n/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim()
  );
}
function mailbox(value: string): string | null {
  // Deliberately small mailbox grammar: one bare address or simple display name.
  const unfolded = value.replace(/\r\n[ \t]+/g, ' ').trim();
  const address = /^[^<>(),;:"\\]*<([^<>]+)>$/.exec(unfolded)?.[1] ?? unfolded;
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(
    address,
  )
    ? address
    : null;
}
/** Strict DKIM subset: one eligible signature among at most four, RSA-SHA256, 2048–4096 bit key,
 * simple/relaxed canonicalization, full body, signed security-relevant headers.
 * The resolver receives only one approved selector/domain query, never message bytes.
 * Its authenticity is a caller obligation; the pilot uses a pinned HTTPS resolver.
 */
export async function verifyDkimContent(
  input: Uint8Array,
  policy: DkimPrototypePolicy,
  resolveKey: KeyResolver,
): Promise<DkimPrototypeResult> {
  try {
    if (input.length > 256 * 1024 || !input.length) return refused('input');
    // Snapshot against caller mutation across awaits; retains raw bytes only in memory.
    const raw = binary(input.slice());
    if (/\r(?!\n)|(?<!\r)\n/.test(raw)) return refused('input');
    const split = raw.indexOf('\r\n\r\n');
    if (split < 0 || split > 64 * 1024) return refused('input');
    const head = raw.slice(0, split);
    if (/[^\x20-\x7e\t\r\n]/.test(head)) return refused('input');
    const headers: Header[] = [];
    for (const line of head.split('\r\n')) {
      if (line.length > 998) return refused('input');
      if (/^[ \t]/.test(line)) {
        const previous = headers.at(-1);
        if (!previous) return refused('input');
        previous.raw += '\r\n' + line;
        previous.value += '\r\n' + line;
      } else {
        const match = /^([!-9;-~]+):(.*)$/.exec(line);
        if (!match) return refused('input');
        headers.push({
          name: match[1]!.toLowerCase(),
          raw: line,
          value: match[2]!,
        });
      }
    }
    if (headers.length > 200) return refused('input');
    const find = (name: string) =>
      headers.filter((header) => header.name === name);
    const signatures = find('dkim-signature');
    if (signatures.length < 1 || signatures.length > 4)
      return refused('signature');
    // Real delivery can add another signature (for example Amazon SES). Only the
    // explicitly mapped signer is eligible; never query or trust the others.
    const eligible = signatures.filter((header) => {
      const claim = tags(header.value);
      return claim.d === policy.signingDomain && claim.s === policy.selector;
    });
    if (eligible.length !== 1) return refused('signature');
    const signature = eligible[0]!;
    if (!/^\s*v\s*=\s*1\s*;/.test(signature.value)) return refused('policy');
    const tag = tags(signature.value);
    const canonical = (tag.c ?? 'simple/simple').split('/');
    if (canonical.length === 1) canonical.push('simple');
    if (
      tag.v !== '1' ||
      tag.a !== 'rsa-sha256' ||
      Object.hasOwn(tag, 'l') ||
      (tag.q && tag.q !== 'dns/txt') ||
      canonical.length !== 2 ||
      canonical.some((mode) => !['simple', 'relaxed'].includes(mode))
    )
      return refused('policy');
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
        policy.signingDomain,
      ) ||
      !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(policy.selector) ||
      tag.d !== policy.signingDomain ||
      tag.s !== policy.selector ||
      (tag.i && tag.i !== '@' + policy.signingDomain) ||
      !Number.isSafeInteger(policy.now) ||
      policy.now < 0 ||
      !Number.isSafeInteger(policy.maxAgeSeconds) ||
      policy.maxAgeSeconds < 1 ||
      policy.maxAgeSeconds > 300
    )
      return refused('policy');
    if (!/^\d{1,12}$/.test(tag.t ?? '')) return refused('policy');
    const signedAt = Number(tag.t);
    const now = Math.floor(policy.now / 1000);
    if (
      signedAt > now ||
      now - signedAt > policy.maxAgeSeconds ||
      (tag.x !== undefined &&
        (!/^\d{1,12}$/.test(tag.x) ||
          Number(tag.x) <= signedAt ||
          now >= Number(tag.x)))
    )
      return refused('policy');
    const signedNames = (tag.h ?? '')
      .replace(/[ \t\r\n]/g, '')
      .toLowerCase()
      .split(':');
    if (
      signedNames.some(
        (name) => !/^[a-z0-9-]+$/.test(name) || name === 'dkim-signature',
      )
    )
      return refused('policy');
    const required = ['from', 'to', 'subject', 'date', 'message-id'];
    const sensitive = [
      ...required,
      'mime-version',
      'content-type',
      'content-transfer-encoding',
      'sender',
      'reply-to',
      'cc',
    ];
    for (const name of sensitive) {
      const count = find(name).length;
      if (
        count > 1 ||
        (required.includes(name) && count !== 1) ||
        (count === 1 && !signedNames.includes(name))
      )
        return refused('policy');
    }
    if (
      mailbox(find('from')[0]!.value) !== policy.from ||
      mailbox(find('to')[0]!.value) !== policy.recipient
    )
      return refused('policy');
    let body = raw.slice(split + 4);
    if (canonical[1] === 'relaxed')
      body = body
        .split('\r\n')
        .map((line) => line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/g, ''))
        .join('\r\n');
    body = body.replace(/(?:\r\n)*$/, '') + '\r\n';
    // RFC6376 relaxed empty body is zero octets; simple empty body is CRLF.
    if (canonical[1] === 'relaxed' && body === '\r\n') body = '';
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', bytes(body)),
    );
    if (binary(digest) !== binary(base64(tag.bh ?? '')))
      return refused('signature');
    const remaining = [...headers];
    const selected: string[] = [];
    for (const name of signedNames) {
      let index = remaining.length - 1;
      while (index >= 0 && remaining[index]!.name !== name) index--;
      if (index >= 0)
        selected.push(
          headerCanonical(
            remaining.splice(index, 1)[0]!.raw,
            canonical[0] === 'relaxed',
          ) + '\r\n',
        );
    }
    // Remove b= value including folding whitespace, retaining surrounding tag syntax.
    const emptySignature = signature.raw.replace(
      /([:;][ \t\r\n]*b[ \t]*=)[^;]*/,
      '$1',
    );
    selected.push(headerCanonical(emptySignature, canonical[0] === 'relaxed'));
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let records: readonly string[];
    try {
      records = await Promise.race([
        resolveKey(
          policy.selector + '._domainkey.' + policy.signingDomain,
          controller.signal,
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error());
          }, 2000);
        }),
      ]);
    } catch {
      return refused('key');
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    if (records.length !== 1 || records[0]!.length > 8192)
      return refused('key');
    const keyTags = tags(records[0]!);
    if (
      (keyTags.v && keyTags.v !== 'DKIM1') ||
      (keyTags.k && keyTags.k !== 'rsa') ||
      (keyTags.h && !keyTags.h.split(':').includes('sha256')) ||
      (keyTags.s &&
        !keyTags.s
          .split(':')
          .some((service) => service === '*' || service === 'email')) ||
      keyTags.t
    )
      return refused('key');
    try {
      const key = await crypto.subtle.importKey(
        'spki',
        base64(keyTags.p ?? ''),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      const algorithm = key.algorithm as RsaHashedKeyAlgorithm;
      if (algorithm.modulusLength < 2048 || algorithm.modulusLength > 4096)
        return refused('key');
      if (
        !(await crypto.subtle.verify(
          'RSASSA-PKCS1-v1_5',
          key,
          base64(tag.b ?? ''),
          bytes(selected.join('')),
        ))
      )
        return refused('signature');
    } catch {
      return refused('key');
    }
    return {
      status: 'content-authenticated',
      receipt: 'unverified',
      replay: 'unresolved',
    };
  } catch {
    return refused('input');
  }
}
