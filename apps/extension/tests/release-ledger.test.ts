import { expect, it } from 'vitest';
import { createReleaseLedger } from '../pipeline/replay';

it('reserves before send and refuses replay across every uncertain crash/ack window', async () => {
  for (const window of [
    'before-send',
    'after-send',
    'before-ack',
    'after-ack',
  ]) {
    let stored: unknown;
    const store = {
      read: async () => stored,
      write: async (v: unknown) => {
        stored = v;
      },
    };
    expect(
      await createReleaseLedger(store, () => 1000000).reserve(
        'account',
        'mailbox',
        'message-' + window,
      ),
    ).toBe(true);
    const restarted = createReleaseLedger(store, () => 1000001);
    expect(
      await restarted.reserve('account', 'mailbox', 'message-' + window),
    ).toBe(false);
    expect(JSON.stringify(stored)).not.toContain('mailbox');
    expect(JSON.stringify(stored)).not.toContain('message-');
  }
  expect(
    await createReleaseLedger({
      read: async () => ({ corrupt: true }),
      write: async () => {},
    }).reserve('a', 'b', 'm'),
  ).toBe(false);
  expect(
    await createReleaseLedger({
      read: async () => undefined,
      write: async () => {
        throw Error();
      },
    }).reserve('a', 'b', 'm'),
  ).toBe(false);
});
