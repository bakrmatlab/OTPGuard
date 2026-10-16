const defaultHeaders = [
  'From: codes@mailer.example',
  'To: owner@example.test',
  'Subject: Synthetic login code',
  'Date: Thu, 1 Jan 1970 00:16:40 +0000',
  'Message-ID: <synthetic@example.test>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: 8bit',
];

/** Raw RFC 5322 bytes for a synthetic email (Gmail's raw format base64url-encodes these). */
export function fixture(options: { body?: string; headers?: string[] } = {}) {
  const body = options.body ?? 'Synthetic login code: 003719\r\n';
  const headers = options.headers ?? defaultHeaders;
  return {
    raw: Buffer.from(headers.join('\r\n') + '\r\n\r\n' + body),
  };
}
