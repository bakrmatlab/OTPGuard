/* eslint-disable no-control-regex -- Reject untrusted controls. */
import type { NormalizedEmail } from './index';

/** Parse the exact signed bytes, never Gmail's separately rendered format=full.
 * Bounded related/alternative containers; plain text is the pilot's authoritative
 * representation. HTML alternatives are not rendered, and attachments refuse.
 */
export function normalizeRawEmail(input: Uint8Array): NormalizedEmail | null {
  try {
    if (!input.length || input.length > 256 * 1024) return null;
    const raw = Array.from(input, (b) => String.fromCharCode(b)).join('');
    if (/\r(?!\n)|(?<!\r)\n/.test(raw)) return null;
    let count = 0;
    function part(
      raw: string,
      depth: number,
    ): { subject: string | undefined; text: string | null } {
      if (++count > 64 || depth > 8) throw Error();
      const split = raw.indexOf('\r\n\r\n');
      if (split < 0 || split > 64 * 1024) throw Error();
      const headers = new Map<string, string>();
      for (const line of raw
        .slice(0, split)
        .replace(/\r\n[ \t]+/g, ' ')
        .split('\r\n')) {
        const h = /^([A-Za-z0-9-]+):[ \t]*(.*)$/.exec(line);
        if (
          !h ||
          (headers.has(h[1]!.toLowerCase()) &&
            !['received', 'dkim-signature', 'authentication-results'].includes(
              h[1]!.toLowerCase(),
            ))
        )
          throw Error();
        headers.set(h[1]!.toLowerCase(), h[2]!);
      }
      if (
        [...headers.keys()].some((n) =>
          /^(resent-|x-forwarded-|in-reply-to|references)/.test(n),
        )
      )
        throw Error();
      const type = headers.get('content-type') ?? 'text/plain';
      if (
        headers.has('content-disposition') &&
        headers.get('content-disposition') !== 'inline'
      )
        throw Error();
      if (/\b(?:name|filename)\s*=/i.test(type)) throw Error();
      const mime = type.split(';')[0]!.trim().toLowerCase();
      const body = raw.slice(split + 4);
      const subject = headers.get('subject');
      if (subject && (subject.length > 1000 || /=\?/.test(subject)))
        throw Error();
      if (['multipart/related', 'multipart/alternative'].includes(mime)) {
        const boundary =
          /;\s*boundary=(?:"([^"\r\n]{1,200})"|([^;\s]{1,200}))/i.exec(type);
        const marker = '--' + (boundary?.[1] ?? boundary?.[2] ?? '');
        if (!boundary) throw Error();
        const lines = body.split('\r\n');
        const children: string[] = [];
        let current: string[] | null = null,
          closed = false;
        for (const line of lines) {
          if (line === marker || line === marker + '--') {
            if (current) children.push(current.join('\r\n') + '\r\n');
            current = [];
            if (line.endsWith('--')) {
              closed = true;
              break;
            }
          } else if (current) current.push(line);
        }
        if (!closed || !children.length) throw Error();
        const texts = children
          .map((c) => part(c, depth + 1).text)
          .filter((t): t is string => t !== null);
        if (texts.length !== 1) throw Error();
        return { subject, text: texts[0]! };
      }
      if (!['text/plain', 'text/html'].includes(mime)) throw Error();
      const charset = /;\s*charset=(?:"([^";]+)"|([^;\s]+))/i.exec(type);
      const encoding = (
        headers.get('content-transfer-encoding') ?? '7bit'
      ).toLowerCase();
      let decoded = body;
      if (encoding === 'quoted-printable') {
        decoded = body.replace(/=\r\n/g, '');
        if (/=(?![0-9a-f]{2})/i.test(decoded)) throw Error();
        decoded = decoded.replace(/=([0-9a-f]{2})/gi, (_, h: string) =>
          String.fromCharCode(parseInt(h, 16)),
        );
      } else if (encoding === 'base64') {
        const compact = body.replace(/[\r\n \t]/g, '');
        if (
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            compact,
          )
        )
          throw Error();
        decoded = atob(compact);
      } else if (!['7bit', '8bit'].includes(encoding)) throw Error();
      const cs = (charset?.[1] ?? charset?.[2] ?? 'us-ascii').toLowerCase();
      if (!['utf-8', 'us-ascii'].includes(cs)) throw Error();
      const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
      if (cs === 'us-ascii' && bytes.some((b) => b > 127)) throw Error();
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (
        text.length > 32768 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(
          text,
        )
      )
        throw Error();
      return { subject, text: mime === 'text/plain' ? text : null };
    }
    const result = part(raw, 0);
    return result.subject && result.text !== null
      ? { subject: result.subject, text: result.text }
      : null;
  } catch {
    return null;
  }
}
