/* eslint-disable no-control-regex -- Reject untrusted controls. */
import { decodeHTMLStrict } from 'entities/decode';
import type { NormalizedEmail } from './index';
export type RawEmailIssue =
  | 'raw-size'
  | 'line-endings'
  | 'parts-limit'
  | 'headers'
  | 'duplicate-headers'
  | 'forwarded'
  | 'disposition'
  | 'subject'
  | 'boundary'
  | 'mime-type'
  | 'transfer-encoding'
  | 'charset'
  | 'text-controls'
  | 'html'
  | 'text-missing';

/** Parse the exact signed bytes, never Gmail's separately rendered format=full.
 * Bounded related/alternative containers; plain text is the pilot's authoritative
 * representation. Generic mode additionally extracts inert HTML text and ignores
 * embedded image/binary resources; resources are never rendered or opened.
 */
export function normalizeRawEmail(
  input: Uint8Array,
  generic = false,
  onFailure: (issue: RawEmailIssue) => void = () => {},
): NormalizedEmail | null {
  let stage: RawEmailIssue = 'raw-size';
  try {
    if (!input.length || input.length > 256 * 1024) throw Error();
    const raw = Array.from(input, (b) => String.fromCharCode(b)).join('');
    stage = 'line-endings';
    if (/\r(?!\n)|(?<!\r)\n/.test(raw)) throw Error();
    let count = 0;
    function part(
      raw: string,
      depth: number,
    ): { subject: string | undefined; text: string | null } {
      stage = 'parts-limit';
      if (++count > 64 || depth > 8) throw Error();
      stage = 'headers';
      const split = raw.indexOf('\r\n\r\n');
      if (split < 0 || split > 64 * 1024) throw Error();
      const headers = new Map<string, string>();
      for (const line of raw
        .slice(0, split)
        .replace(/\r\n[ \t]+/g, ' ')
        .split('\r\n')) {
        const h = /^([A-Za-z0-9-]+):[ \t]*(.*)$/.exec(line);
        stage = 'headers';
        if (!h) throw Error();
        stage = 'duplicate-headers';
        if (
          headers.has(h[1]!.toLowerCase()) &&
          !(generic
            ? ![
                'subject',
                'content-type',
                'content-transfer-encoding',
                'content-disposition',
                'to',
                'cc',
                'from',
              ].includes(h[1]!.toLowerCase())
            : ['received', 'dkim-signature', 'authentication-results'].includes(
                h[1]!.toLowerCase(),
              ))
        )
          throw Error();
        headers.set(h[1]!.toLowerCase(), h[2]!);
      }
      stage = 'forwarded';
      if (
        [...headers.keys()].some((n) =>
          /^(resent-|x-forwarded-|in-reply-to|references)/.test(n),
        )
      )
        throw Error();
      const type = headers.get('content-type') ?? 'text/plain';
      stage = 'mime-type';
      if (generic) validateParameters(type);
      const mime = type.split(';')[0]!.trim().toLowerCase();
      const disposition = headers
        .get('content-disposition')
        ?.split(';')[0]
        ?.trim()
        .toLowerCase();
      // Embedded images and binary attachments are inert resources, not code text.
      // Attached/forwarded email bodies are deliberately unsupported.
      if (
        generic &&
        depth > 0 &&
        (mime.startsWith('image/') ||
          (mime.startsWith('application/') && disposition === 'attachment'))
      )
        return { subject: undefined, text: null };
      stage = 'disposition';
      if (
        headers.has('content-disposition') &&
        (generic
          ? disposition !== 'inline'
          : headers.get('content-disposition') !== 'inline')
      )
        throw Error();
      if (/\b(?:name|filename)\s*=/i.test(type)) throw Error();
      const body = raw.slice(split + 4);
      stage = 'subject';
      const headerSubject = headers.get('subject');
      if (headerSubject && headerSubject.length > 1000) throw Error();
      const subject =
        generic && headerSubject ? decodeSubject(headerSubject) : headerSubject;
      if (subject && (subject.length > 1000 || /=\?/.test(subject)))
        throw Error();
      if (
        [
          'multipart/related',
          'multipart/alternative',
          ...(generic ? ['multipart/mixed'] : []),
        ].includes(mime)
      ) {
        stage = 'boundary';
        const boundary = (
          generic
            ? /;\s*boundary\s*=\s*(?:"([^"\r\n]{1,200})"|([^;\s]{1,200}))/i
            : /;\s*boundary=(?:"([^"\r\n]{1,200})"|([^;\s]{1,200}))/i
        ).exec(type);
        const marker = '--' + (boundary?.[1] ?? boundary?.[2] ?? '');
        if (!boundary) throw Error();
        const lines = body.split('\r\n');
        const children: string[] = [];
        let current: string[] | null = null,
          closed = false;
        for (const line of lines) {
          const boundaryLine = generic ? line.replace(/[ \t]+$/, '') : line;
          if (boundaryLine === marker || boundaryLine === marker + '--') {
            if (current) children.push(current.join('\r\n') + '\r\n');
            current = [];
            if (boundaryLine.endsWith('--')) {
              closed = true;
              break;
            }
          } else if (current) current.push(line);
        }
        if (!closed || !children.length) throw Error();
        const texts = children
          .map((c) => part(c, depth + 1).text)
          .filter((t): t is string => t !== null);
        stage = 'text-missing';
        if (!texts.length || (!generic && texts.length !== 1)) throw Error();
        return { subject, text: generic ? texts.join('\n') : texts[0]! };
      }
      stage = 'mime-type';
      if (!['text/plain', 'text/html'].includes(mime)) throw Error();
      const charset = (
        generic
          ? /;\s*charset\s*=\s*(?:"([^";]+)"|([^;\s]+))/i
          : /;\s*charset=(?:"([^";]+)"|([^;\s]+))/i
      ).exec(type);
      const transfer = headers.get('content-transfer-encoding') ?? '7bit';
      const encoding = (generic ? transfer.trim() : transfer).toLowerCase();
      stage = 'transfer-encoding';
      let decoded = body;
      if (encoding === 'quoted-printable') {
        decoded = body.replace(/=\r\n/g, '');
        if (/=(?![0-9a-f]{2})/i.test(decoded)) throw Error();
        decoded = decoded.replace(/=([0-9a-f]{2})/gi, (_, h: string) =>
          String.fromCharCode(parseInt(h, 16)),
        );
      } else if (encoding === 'base64') {
        let compact = body.replace(/[\r\n \t]/g, '');
        if (
          generic &&
          /^[A-Za-z0-9+/]+$/.test(compact) &&
          compact.length % 4 !== 1
        )
          compact = compact.padEnd(Math.ceil(compact.length / 4) * 4, '=');
        if (
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            compact,
          )
        )
          throw Error();
        decoded = atob(compact);
      } else if (!['7bit', '8bit'].includes(encoding)) throw Error();
      stage = 'charset';
      // Generic mail commonly omits charset on valid UTF-8 bodies. Decode it
      // once as UTF-8 (ASCII is a subset); never guess a legacy encoding.
      const label =
        charset?.[1] ?? charset?.[2] ?? (generic ? 'utf-8' : 'us-ascii');
      const cs = (generic ? label.trim() : label).toLowerCase();
      if (!generic && !['utf-8', 'us-ascii'].includes(cs)) throw Error();
      const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
      const ascii = [
        'us-ascii',
        ...(generic ? ['ascii', 'ansi_x3.4-1968'] : []),
      ].includes(cs);
      if (ascii && bytes.some((b) => b > 127)) throw Error();
      // Use the browser's standard encoding labels, with no replacement decoding
      // or guessed fallback. Unsupported labels and malformed bytes still refuse.
      const decodedText = new TextDecoder(ascii ? 'utf-8' : cs, {
        fatal: true,
      }).decode(bytes);
      const text =
        generic && mime === 'text/html'
          ? decodedText.replace(/[\u200b-\u200d\ufeff]/g, '\n')
          : decodedText;
      stage = 'text-controls';
      if (
        text.length > (generic && mime === 'text/html' ? 256 * 1024 : 32768) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(
          text,
        )
      )
        throw Error();
      stage = 'html';
      return {
        subject,
        text:
          mime === 'text/plain' ? text : generic ? inertHtmlText(text) : null,
      };
    }
    const result = part(raw, 0);
    if ((!generic && !result.subject) || result.text === null) {
      stage = 'text-missing';
      throw Error();
    }
    stage = 'text-controls';
    if (generic && result.text.length > 32768) throw Error();
    return { subject: result.subject ?? '', text: result.text };
  } catch {
    onFailure(stage);
    return null;
  }
}

/** Inert lexical text extraction: no DOM, execution, fetching or visual trust. Hidden
 * text remains visible to ambiguity checks. Active blocks are not OTP text. */
function inertHtmlText(html: string): string {
  const inert = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/?(?:span|b|strong|em|i|u|small|font)\b[^>]*>/gi, '')
    .replace(/<[^>]*>/g, '\n');
  // Validate numeric references before standards decoding substitutes invalid ones.
  for (const match of inert.matchAll(/&#(x[0-9a-f]+|[0-9]+);/gi)) {
    const value = match[1]!;
    const n =
      value[0]?.toLowerCase() === 'x'
        ? parseInt(value.slice(1), 16)
        : Number(value);
    if (n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) throw Error();
  }
  if (/[<>]/.test(inert)) throw Error();
  // Decode after stripping markup: decoded '<' is ordinary text, never parsed again.
  // Unknown named references remain literal. Invisible preheader padding becomes
  // separators, so it cannot join fragments into a code or hide competing text.
  const text = decodeHTMLStrict(inert).replace(/[\u200b-\u200d\ufeff]/g, '\n');
  if (
    text.length > 32768 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(
      text,
    )
  )
    throw Error();
  return text;
}

/** Bounded RFC 2047 decoding for candidate-only mode. Signed pilot templates keep
 * their original strict subject contract. Unsupported or malformed words refuse. */
function decodeSubject(subject: string): string {
  const decoded = subject
    .replace(/(\?=)[ \t]+(?==\?)/g, '$1')
    .replace(
      /=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,
      (_, charset: string, encoding: string, content: string) => {
        let binary: string;
        if (encoding.toLowerCase() === 'b') {
          if (
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
              content,
            )
          )
            throw Error();
          binary = atob(content);
        } else {
          if (/[^\x21-\x7e]|=(?![0-9a-f]{2})/i.test(content)) throw Error();
          binary = content
            .replace(/_/g, ' ')
            .replace(/=([0-9a-f]{2})/gi, (_, hex: string) =>
              String.fromCharCode(parseInt(hex, 16)),
            );
        }
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const ascii = ['us-ascii', 'ascii', 'ansi_x3.4-1968'].includes(
          charset.toLowerCase(),
        );
        if (ascii && bytes.some((b) => b > 127)) throw Error();
        return new TextDecoder(ascii ? 'utf-8' : charset, {
          fatal: true,
        }).decode(bytes);
      },
    );
  if (
    /=\?|[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(
      decoded,
    )
  )
    throw Error();
  return decoded;
}

/** Do not silently guess a default when critical MIME parameters conflict. */
function validateParameters(type: string) {
  for (const name of ['charset', 'boundary']) {
    const declarations = [
      ...type.matchAll(new RegExp(';\\s*' + name + '\\s*=', 'gi')),
    ];
    if (declarations.length > 1) throw Error();
    if (
      declarations.length &&
      !new RegExp(';\\s*' + name + '\\s*=\\s*(?:"[^";]+"|[^;\\s]+)', 'i').test(
        type,
      )
    )
      throw Error();
  }
}

/** Bounded relevance hints only; never authenticated sender/recipient evidence. */
export function rawEmailHints(
  input: Uint8Array,
): { subject: string; recipients: string[]; senderDomain?: string } | null {
  try {
    if (input.length > 256 * 1024) return null;
    const raw = Array.from(input, (byte) => String.fromCharCode(byte)).join('');
    const split = raw.indexOf('\r\n\r\n');
    if (split < 0 || split > 64 * 1024) return null;
    const headers = raw
      .slice(0, split)
      .replace(/\r\n[ \t]+/g, ' ')
      .split('\r\n');
    const subjects = headers.filter((line) => /^subject:/i.test(line));
    const recipients = headers.filter((line) => /^(to|cc):/i.test(line));
    if (
      subjects.length > 1 ||
      headers.some((line) => !/^[A-Za-z0-9-]+:/.test(line))
    )
      return null;
    const from = headers.filter((line) => /^from:/i.test(line));
    const fromAddresses =
      from.length === 1
        ? [
            ...from[0]!.matchAll(
              /[A-Za-z0-9._%+-]{1,128}@([A-Za-z0-9](?:[A-Za-z0-9.-]{0,126}[A-Za-z0-9])?)/g,
            ),
          ]
        : [];
    const subject = subjects[0]?.replace(/^subject:\s*/i, '') ?? '';
    if (subject.length > 1000) return null;
    return {
      subject: decodeSubject(subject),
      ...(fromAddresses.length === 1
        ? { senderDomain: fromAddresses[0]![1]!.toLowerCase() }
        : {}),
      recipients: [
        ...recipients
          .join(' ')
          .matchAll(
            /[A-Za-z0-9._%+-]{1,128}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,126}[A-Za-z0-9])?/g,
          ),
      ].map((match) => match[0].toLowerCase()),
    };
  } catch {
    return null;
  }
}
