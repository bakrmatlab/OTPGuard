import type { AccountBinding } from '../account/gate';

export interface RememberedMailboxStore {
  read(): Promise<unknown>;
  write(value: RememberedMailbox): Promise<void>;
  remove(): Promise<void>;
}
export interface RememberedMailbox {
  version: 1;
  ownerDigest: string;
  mailboxDigest: string;
}
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
export const ownerDigest = (
  binding: Pick<AccountBinding, 'userId' | 'sessionId'>,
) => hash(JSON.stringify([binding.userId, binding.sessionId]));
export const mailboxDigest = (owner: string, mailbox: string) =>
  hash(JSON.stringify([owner, mailbox.toLowerCase()]));
export async function rememberMailbox(
  binding: AccountBinding,
  mailbox: string,
): Promise<RememberedMailbox> {
  const owner = await ownerDigest(binding);
  return {
    version: 1,
    ownerDigest: owner,
    mailboxDigest: await mailboxDigest(owner, mailbox),
  };
}
export function parseRememberedMailbox(raw: unknown): RememberedMailbox | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<RememberedMailbox>;
  return Object.keys(value).length === 3 &&
    value.version === 1 &&
    typeof value.ownerDigest === 'string' &&
    /^[a-f0-9]{64}$/.test(value.ownerDigest) &&
    typeof value.mailboxDigest === 'string' &&
    /^[a-f0-9]{64}$/.test(value.mailboxDigest)
    ? (value as RememberedMailbox)
    : null;
}
