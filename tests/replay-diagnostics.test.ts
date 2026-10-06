import { expect, it } from 'vitest';
import { createReleaseLedger } from '../apps/extension/pipeline/replay';
it('distinguishes reused email from unavailable storage and accepts a fresh message', async () => {
  let stored: unknown;
  const ledger = createReleaseLedger(
    {
      read: async () => stored,
      write: async (value) => {
        stored = value;
      },
    },
    () => 100000,
  );
  expect(
    await ledger.reserveDetailed('account', 'mailbox', 'old-message'),
  ).toBe('reserved');
  expect(
    await ledger.reserveDetailed('account', 'mailbox', 'old-message'),
  ).toBe('already-used');
  expect(
    await ledger.reserveDetailed('account', 'mailbox', 'fresh-message'),
  ).toBe('reserved');
  expect(
    await createReleaseLedger({
      read: async () => ({ corrupt: true }),
      write: async () => {},
    }).reserveDetailed('account', 'mailbox', 'message'),
  ).toBe('unavailable');
  expect(
    await createReleaseLedger({
      read: async () => undefined,
      write: async () => {
        throw Error('Synthetic write unavailable');
      },
    }).reserveDetailed('account', 'mailbox', 'message'),
  ).toBe('unavailable');
});
