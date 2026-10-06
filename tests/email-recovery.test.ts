import { expect, test, vi } from 'vitest';
import { createEmailRecovery } from '../apps/extension/pipeline/email-recovery';
import type { Context } from '../apps/extension/pipeline/coordinator';
const context: Context = {
  accountId: 'account',
  accountSession: { userId: 'account', sessionId: 'session', generation: 1 },
  mailboxId: 'mailbox',
  tabId: 1,
  documentId: 'document',
  origin: 'https://fixture.invalid',
  browserUrl: 'https://fixture.invalid/login',
  policyUrl: 'https://fixture.invalid/login',
  serviceId: 'generic',
  foreground: true,
};
function setup() {
  let now = 0;
  const current = vi.fn(async () => true);
  const scan = vi.fn(async () => true);
  const recovery = createEmailRecovery({
    now: () => now,
    id: () => 'intent',
    current,
    scan,
  });
  return {
    recovery,
    current,
    scan,
    advance: () => {
      now = 30000;
    },
  };
}
test('intent authorizes one bound scan and never scans before confirmation', async () => {
  const { recovery, scan } = setup();
  expect(recovery.offer(context, 'fields-1')).toBe(true);
  expect(scan).not.toHaveBeenCalled();
  expect(await recovery.confirm('wrong')).toBe(false);
  expect(await recovery.confirm('intent')).toBe(true);
  expect(scan).toHaveBeenCalledExactlyOnceWith(context, 'fields-1');
  expect(await recovery.confirm('intent')).toBe(false);
});
test('expired or revoked authority never scans', async () => {
  for (const reason of ['expiry', 'authority', 'clear']) {
    const { recovery, scan, current, advance } = setup();
    recovery.offer(context, 'fields-1');
    if (reason === 'expiry') advance();
    if (reason === 'authority') current.mockResolvedValue(false);
    if (reason === 'clear') recovery.clear();
    expect(await recovery.confirm('intent')).toBe(false);
    expect(scan).not.toHaveBeenCalled();
    expect(recovery.status()).toBeNull();
  }
});
test('revocation while authority is being checked prevents a scan', async () => {
  const { recovery, current, scan } = setup();
  recovery.offer(context, 'fields-1');
  current.mockImplementation(async () => {
    recovery.clear();
    return true;
  });
  expect(await recovery.confirm('intent')).toBe(false);
  expect(scan).not.toHaveBeenCalled();
});
test('missing bindings and invalid group identities cannot offer intent', () => {
  const { recovery } = setup();
  for (const key of ['accountId', 'accountSession', 'mailboxId'] as const)
    expect(recovery.offer({ ...context, [key]: undefined }, 'fields-1')).toBe(
      false,
    );
  expect(recovery.offer(context, {})).toBe(false);
  expect(recovery.status()).toBeNull();
});
