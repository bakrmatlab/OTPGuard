/* eslint-disable no-control-regex -- Deliberately reject untrusted control characters. */
import type { NormalizedEmail } from './index';

/** Limits apply to all parts, including alternatives; estimates are never the sole bound. */
export const gmailNormalizationLimits = Object.freeze({
  decodedBytes: 256 * 1024,
  parts: 64,
  depth: 8,
  headers: 200,
  headerCharacters: 64 * 1024,
  textCharacters: 32_768,
});
export interface GmailHeader {
  name: string;
  value: string;
}
export interface NormalizedGmailMessage {
  messageId: string;
  email: NormalizedEmail;
  /** Gmail metadata, NOT a trusted SMTP receipt without delivery provenance. */
  receipt: { status: 'unverified'; internalDate: number };
  /** Untrusted claims retained only in memory for the evidence adapter. */
  headers: readonly GmailHeader[];
}
export type GmailNormalizationResult =
  | { status: 'normalized'; message: NormalizedGmailMessage }
  | {
      status: 'rejected';
      reason:
        | 'limit'
        | 'malformed'
        | 'unsupported'
        | 'delivery'
        | 'alternatives';
    };
class Rejection extends Error {
  constructor(
    readonly reason: Extract<
      GmailNormalizationResult,
      { status: 'rejected' }
    >['reason'],
  ) {
    super(reason);
  }
}
const reject = (reason: Rejection['reason']): never => {
  throw new Rejection(reason);
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return reject('malformed');
  return value as Record<string, unknown>;
};
const integer = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    return reject('malformed');
  return value;
};

/** Canonical base64url only, including optional correct padding and zero pad bits. */
function decode(data: unknown): Uint8Array {
  if (typeof data !== 'string') return reject('malformed');
  if (data.length > Math.ceil(gmailNormalizationLimits.decodedBytes / 3) * 4)
    return reject('limit');
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(data)) return reject('malformed');
  const raw = data.replace(/=+$/, '');
  const remainder = raw.length % 4;
  if (
    remainder === 1 ||
    (raw.length !== data.length &&
      (data.length % 4 !== 0 ||
        data.length - raw.length !== (4 - remainder) % 4))
  )
    return reject('malformed');
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const last = raw ? alphabet.indexOf(raw.at(-1)!) : 0;
  if ((remainder === 2 && last & 15) || (remainder === 3 && last & 3))
    return reject('malformed');
  const bytes = new Uint8Array(Math.floor((raw.length * 3) / 4));
  let buffer = 0,
    bits = 0,
    index = 0;
  for (const char of raw) {
    buffer = (buffer << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >>> bits) & 255;
    }
  }
  return bytes;
}

/** No DOM, resources, script evaluation or CSS rendering. A small strict HTML subset.
 * Unsupported/hidden/active markup rejects the whole body instead of hiding ambiguity.
 */
function htmlText(html: string): string {
  const allowed = new Set([
    'html',
    'head',
    'title',
    'body',
    'div',
    'p',
    'br',
    'span',
    'b',
    'strong',
    'i',
    'em',
    'table',
    'tbody',
    'tr',
    'td',
    'th',
    'a',
    'img',
    'hr',
    'h1',
    'h2',
    'h3',
  ]);
  const blocks = new Set([
    'div',
    'p',
    'br',
    'tr',
    'td',
    'th',
    'hr',
    'h1',
    'h2',
    'h3',
    'body',
  ]);
  const stack: string[] = [];
  let output = '',
    offset = 0;
  while (offset < html.length) {
    if (html[offset] !== '<') {
      const end = html.indexOf('<', offset);
      output += html.slice(offset, end < 0 ? html.length : end);
      offset = end < 0 ? html.length : end;
      continue;
    }
    const end = html.indexOf('>', offset);
    if (end < 0) return reject('malformed');
    if (end - offset > 4096) return reject('limit');
    const token = html.slice(offset, end + 1);
    const match = /^<(\/)?([a-z][a-z0-9]*)(\s[^<>]*?)?\s*(\/?)>$/i.exec(token);
    if (!match) return reject('unsupported');
    const name = match[2]!.toLowerCase();
    if (!allowed.has(name)) return reject('unsupported');
    // Attributes have no semantic authority. Refuse anything that could hide text,
    // execute behavior, embed quoted mail or complicate lexical tokenization.
    const attrs = match[3] ?? '';
    if (/[\x00-\x1f]|\b(?:style|hidden|class|id|on[a-z]+)\s*=?/i.test(attrs))
      return reject('unsupported');
    if (
      attrs &&
      !/^(?:\s+[a-z][a-z0-9-]*\s*=\s*(?:"[^"<>]*"|'[^'<>]*'))*\s*$/i.test(attrs)
    )
      return reject('malformed');
    const voidElement = ['br', 'img', 'hr'].includes(name);
    if (match[1]) {
      if (attrs.trim() || voidElement || stack.pop() !== name)
        return reject('malformed');
    } else if (!voidElement) {
      if (match[4]) return reject('unsupported');
      stack.push(name);
      if (stack.length > 64) return reject('limit');
    }
    if (blocks.has(name)) output += '\n';
    // Images are deliberately not rendered; alt could conceal another code.
    if (name === 'img' && /\balt\s*=\s*["'][^"']+/i.test(attrs))
      return reject('unsupported');
    offset = end + 1;
  }
  if (stack.length) return reject('malformed');
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  output = output.replace(/&([^;\s&]+);/g, (_, entity: string) => {
    if (Object.hasOwn(entities, entity)) return entities[entity]!;
    if (!/^#(?:[0-9]{1,7}|x[0-9a-f]{1,6})$/i.test(entity))
      return reject('unsupported');
    const point =
      entity[1]?.toLowerCase() === 'x'
        ? parseInt(entity.slice(2), 16)
        : Number(entity.slice(1));
    if (point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff))
      return reject('malformed');
    return String.fromCodePoint(point);
  });
  if (/&(?:#|[a-z])/i.test(output)) return reject('unsupported');
  return output;
}
const cleanText = (text: string): string => {
  if (
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/.test(
      text,
    )
  )
    return reject('unsupported');
  const clean = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  if (clean.length > gmailNormalizationLimits.textCharacters)
    return reject('limit');
  if (
    /(^|\n)\s*(>|on .+wrote:|[- ]*(?:original|forwarded) message|begin forwarded message:|from:)/i.test(
      clean,
    )
  )
    return reject('delivery');
  return clean;
};

/** Input is Gmail format=full JSON, not raw RFC822. No attachment fetch or transfer
 * decoding: API body.data is already the part's base64url bytes. */
export function normalizeGmailMessage(
  input: unknown,
): GmailNormalizationResult {
  try {
    const message = object(input);
    if (
      typeof message.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(message.id)
    )
      return reject('malformed');
    if (
      typeof message.internalDate !== 'string' ||
      !/^(0|[1-9][0-9]{0,15})$/.test(message.internalDate)
    )
      return reject('malformed');
    const internalDate = integer(Number(message.internalDate));
    if (integer(message.sizeEstimate) > gmailNormalizationLimits.decodedBytes)
      return reject('limit');
    let parts = 0,
      bytes = 0,
      headerCount = 0,
      headerChars = 0,
      headerBytes = 0;
    let rootHeaders: GmailHeader[] = [];
    function visit(value: unknown, depth: number): string {
      if (
        ++parts > gmailNormalizationLimits.parts ||
        depth > gmailNormalizationLimits.depth
      )
        return reject('limit');
      const part = object(value);
      if (
        typeof part.mimeType !== 'string' ||
        typeof part.filename !== 'string'
      )
        return reject('malformed');
      if (part.filename) return reject('delivery');
      if (!Array.isArray(part.headers)) return reject('malformed');
      const headers: GmailHeader[] = [];
      for (const value of part.headers) {
        const header = object(value);
        if (
          typeof header.name !== 'string' ||
          !/^[A-Za-z0-9-]{1,78}$/.test(header.name) ||
          typeof header.value !== 'string'
        )
          return reject('malformed');
        headerChars += header.name.length + header.value.length;
        if (
          ++headerCount > gmailNormalizationLimits.headers ||
          headerChars > gmailNormalizationLimits.headerCharacters
        )
          return reject('limit');
        headerBytes += new TextEncoder().encode(
          header.name + header.value,
        ).length;
        if (headerBytes + bytes > gmailNormalizationLimits.decodedBytes)
          return reject('limit');
        const unfolded = header.value.replace(/\r\n[\t ]+/g, ' ');
        if (/[\x00-\x1f\x7f]/.test(unfolded)) return reject('malformed');
        headers.push({ name: header.name.toLowerCase(), value: unfolded });
      }
      if (depth === 0) rootHeaders = headers;
      if (
        headers.some((h) =>
          /^(?:resent-|x-forwarded-|forwarded|in-reply-to|references)/.test(
            h.name,
          ),
        )
      )
        return reject('delivery');
      const values = (name: string) =>
        headers.filter((h) => h.name === name).map((h) => h.value);
      const contentTypes = values('content-type');
      if (contentTypes.length > 1 || values('content-disposition').length > 1)
        return reject('malformed');
      if (values('content-disposition').some((v) => !/^inline\s*$/i.test(v)))
        return reject('delivery');
      const mime = part.mimeType.toLowerCase();
      const type = contentTypes[0];
      let charset = 'us-ascii';
      if (type) {
        const parsed =
          /^([a-z]+\/[a-z0-9.+-]+)(?:\s*;\s*(?:charset\s*=\s*(?:"([a-z0-9-]+)"|([a-z0-9-]+))|boundary\s*=\s*(?:"[^"\r\n]+"|[a-z0-9_-]+)))?\s*$/i.exec(
            type,
          );
        if (!parsed || parsed[1]!.toLowerCase() !== mime)
          return reject('unsupported');
        const declaredCharset = parsed[2] ?? parsed[3];
        if (declaredCharset) charset = declaredCharset.toLowerCase();
      }
      const body = object(part.body);
      if (body.attachmentId !== undefined) return reject('delivery');
      const size = integer(body.size);
      if (size > gmailNormalizationLimits.decodedBytes) return reject('limit');
      if (mime === 'multipart/alternative') {
        if (
          size !== 0 ||
          (body.data !== undefined && body.data !== '') ||
          !Array.isArray(part.parts) ||
          !part.parts.length
        )
          return reject('malformed');
        if (part.parts.length > gmailNormalizationLimits.parts)
          return reject('limit');
        const alternatives = part.parts.map((child) => visit(child, depth + 1));
        if (alternatives.some((text) => text !== alternatives[0]))
          return reject('alternatives');
        return alternatives[0]!;
      }
      if (mime !== 'text/plain' && mime !== 'text/html')
        return reject('unsupported');
      if (
        part.parts !== undefined &&
        (!Array.isArray(part.parts) || part.parts.length)
      )
        return reject('malformed');
      if (!['utf-8', 'us-ascii', 'iso-8859-1'].includes(charset))
        return reject('unsupported');
      const decoded = decode(body.data);
      if (decoded.length !== size) return reject('malformed');
      bytes += decoded.length;
      if (bytes + headerBytes > gmailNormalizationLimits.decodedBytes)
        return reject('limit');
      let text: string;
      if (charset === 'utf-8') {
        try {
          text = new TextDecoder('utf-8', {
            fatal: true,
            ignoreBOM: true,
          }).decode(decoded);
        } catch {
          return reject('malformed');
        }
      } else {
        if (charset === 'us-ascii' && decoded.some((byte) => byte > 127))
          return reject('malformed');
        text = Array.from(decoded, (byte) => String.fromCharCode(byte)).join(
          '',
        );
      }
      return cleanText(mime === 'text/html' ? htmlText(text) : text);
    }
    const text = visit(message.payload, 0);
    const subjects = rootHeaders.filter((h) => h.name === 'subject');
    if (subjects.length !== 1 || subjects[0]!.value.length > 1000)
      return reject('malformed');
    // Encoded subject words need separate RFC2047 support; do not guess.
    if (/=\?/.test(subjects[0]!.value)) return reject('unsupported');
    const subject = cleanText(subjects[0]!.value);
    return {
      status: 'normalized',
      message: {
        messageId: message.id,
        email: { subject, text },
        receipt: { status: 'unverified', internalDate },
        headers: rootHeaders,
      },
    };
  } catch (error) {
    return {
      status: 'rejected',
      reason: error instanceof Rejection ? error.reason : 'malformed',
    };
  }
}
