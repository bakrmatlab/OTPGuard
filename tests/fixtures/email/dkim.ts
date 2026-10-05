import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import type { DkimPrototypePolicy } from '../../../development/dkim/verify';
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const record =
  'v=DKIM1; k=rsa; p=' +
  pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
export const policy: DkimPrototypePolicy = {
  signingDomain: 'mailer.example',
  selector: 'test',
  from: 'codes@mailer.example',
  recipient: 'owner@example.test',
  now: 1000000,
  maxAgeSeconds: 300,
};
const headerLines = [
  'From: codes@mailer.example',
  'To: owner@example.test',
  'Subject: Synthetic login code',
  'Date: Thu, 1 Jan 1970 00:16:40 +0000',
  'Message-ID: <synthetic@example.test>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: 8bit',
];
const names = [
  'from',
  'to',
  'subject',
  'date',
  'message-id',
  'mime-version',
  'content-type',
  'content-transfer-encoding',
];
export function fixture(
  options: {
    body?: string;
    canonicalBody?: string;
    tags?: string;
    headers?: string[];
    relaxed?: boolean;
    weak?: boolean;
  } = {},
) {
  const body = options.body ?? 'Synthetic login code: 003719\r\n';
  const headers = options.headers ?? headerLines;
  const bh = createHash('sha256')
    .update(options.canonicalBody ?? body)
    .digest('base64');
  const signature = `DKIM-Signature: v=1; a=rsa-sha256; c=${options.relaxed ? 'relaxed/relaxed' : 'simple/simple'}; d=mailer.example; s=test; t=1000; h=${names.join(':')}; bh=${bh}; ${options.tags ?? ''}b=`;
  // Independent signing uses Node/OpenSSL. Baseline bytes are already canonical;
  // relaxed header literals here contain no folded whitespace or repeated WSP.
  const canonical = options.relaxed
    ? [...headers, signature].map(
        (line) =>
          line.slice(0, line.indexOf(':')).toLowerCase() +
          ':' +
          line.slice(line.indexOf(':') + 1).trim(),
      )
    : [...headers, signature];
  const key = options.weak
    ? generateKeyPairSync('rsa', { modulusLength: 1024 })
    : pair;
  const b = sign(
    'RSA-SHA256',
    Buffer.from(canonical.join('\r\n')),
    key.privateKey,
  ).toString('base64');
  return {
    raw: Buffer.from(
      signature + b + '\r\n' + headers.join('\r\n') + '\r\n\r\n' + body,
    ),
    record: options.weak
      ? 'v=DKIM1; p=' +
        key.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
      : record,
  };
}
