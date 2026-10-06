import { describe, expect, it, vi } from 'vitest';
import { createAccountGate } from '../apps/extension/account/gate';
import {
  createWebsiteManagement,
  parseBrowserRequest,
  websiteSender,
} from '../apps/extension/website-management';
const origin = 'https://otpguard.net';
const sender = {
  url: origin + '/dashboard',
  origin,
  frameId: 0,
  documentId: 'document-1',
  tab: { id: 7 },
};
const identity = {
  userId: 'user_test',
  sessionId: 'sess_test',
  label: 'Synthetic',
  expiresAt: Date.now() + 30_000,
};
const request = (action: unknown = { type: 'browser-status' }) => ({
  version: 1,
  userId: identity.userId,
  sessionId: identity.sessionId,
  action,
});
function setup() {
  let user: typeof identity | null = identity;
  const gate = createAccountGate(async () => user);
  const documentCurrent = vi.fn(async () => true);
  const run = vi.fn(async () => ({ state: 'UNAVAILABLE' as const }));
  const handle = createWebsiteManagement({
    origin,
    gate,
    documentCurrent,
    run,
  });
  return {
    gate,
    run,
    documentCurrent,
    handle,
    switchAccount() {
      user = { ...identity, userId: 'user_other' };
    },
    logout() {
      user = null;
      gate.invalidate();
    },
  };
}
describe('website management boundary', () => {
  it('allows only exact production top-level dashboard documents', () => {
    expect(websiteSender(sender, origin)).toBe(true);
    for (const wrong of [
      { ...sender, id: 'another-extension' },
      { ...sender, frameId: 1 },
      { ...sender, documentId: undefined },
      { ...sender, tab: undefined },
      { ...sender, origin: 'https://evil.test' },
      { ...sender, url: origin + '/dashboard?redirect=1' },
      { ...sender, url: origin + '/help' },
      { ...sender, url: 'https://otpguard.net.evil.test/dashboard' },
      { ...sender, url: 'http://otpguard.net/dashboard' },
      { ...sender, url: 'https://otpguard.net:444/dashboard' },
      { ...sender, url: 'http://127.0.0.1:4319/dashboard' },
    ])
      expect(websiteSender(wrong, origin)).toBe(false);
    expect(websiteSender(sender, undefined)).toBe(false);
  });
  it('accepts bounded management schemas and rejects pipeline authority or extra secret fields', () => {
    for (const type of [
      'browser-status',
      'gmail-connect',
      'gmail-disconnect',
      'history-export',
      'history-delete',
      'open-options',
    ])
      expect(parseBrowserRequest(request({ type }))).not.toBeNull();
    expect(
      parseBrowserRequest(
        request({ type: 'settings-autofill', enabled: false }),
      ),
    ).not.toBeNull();
    expect(
      parseBrowserRequest(
        request({
          type: 'settings-block',
          origin: 'https://example.com',
          blocked: true,
        }),
      ),
    ).not.toBeNull();
    for (const value of [
      null,
      {},
      { ...request(), version: 2 },
      { ...request(), userId: '' },
      { ...request(), sessionId: 'sess_' + 'x'.repeat(129) },
      { ...request(), token: 'secret' },
      request({ type: 'pipeline-fill', requestId: 'test' }),
      request({ type: 'pipeline-status' }),
      request({ type: 'account-sign-out' }),
      request({ type: 'browser-status', code: 'synthetic' }),
      request({ type: 'settings-autofill', enabled: 'yes' }),
      request({
        type: 'settings-block',
        origin: 'https://example.com/path',
        blocked: true,
      }),
    ])
      expect(parseBrowserRequest(value)).toBeNull();
  });
  it('requires matching authoritative account and selected session before dispatch', async () => {
    const s = setup();
    for (const value of [
      { ...request(), userId: 'user_other' },
      { ...request(), sessionId: 'sess_other' },
    ])
      expect(await s.handle(value, sender)).toEqual({ state: 'REFUSED' });
    expect(s.run).not.toHaveBeenCalled();
    expect(await s.handle(request(), sender)).toEqual({ state: 'UNAVAILABLE' });
    expect(s.run).toHaveBeenCalledOnce();
    s.gate.invalidate();
  });
  it('refuses navigation and logout before dispatch', async () => {
    const s = setup();
    s.documentCurrent.mockResolvedValue(false);
    expect(await s.handle(request(), sender)).toEqual({ state: 'REFUSED' });
    expect(s.run).not.toHaveBeenCalled();
    s.documentCurrent.mockResolvedValue(true);
    s.logout();
    expect(await s.handle(request(), sender)).toEqual({ state: 'REFUSED' });
    expect(s.run).not.toHaveBeenCalled();
  });
  it('withholds responses after account switch, logout or document replacement during work', async () => {
    for (const change of ['account', 'logout', 'document']) {
      const s = setup();
      s.run.mockImplementation(async () => {
        if (change === 'account') s.switchAccount();
        if (change === 'logout') s.logout();
        if (change === 'document') s.documentCurrent.mockResolvedValue(false);
        return { state: 'UNAVAILABLE' };
      });
      expect(await s.handle(request(), sender)).toEqual({ state: 'REFUSED' });
      s.gate.invalidate();
    }
  });
  it('bounds concurrent requests and recovers after a failed operation', async () => {
    const s = setup();
    let release!: () => void;
    s.run.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      throw new Error('secret failure');
    });
    const first = s.handle(request(), sender);
    await vi.waitFor(() => expect(s.run).toHaveBeenCalledOnce());
    expect(await s.handle(request(), sender)).toEqual({ state: 'BUSY' });
    release();
    expect(await first).toEqual({ state: 'UNAVAILABLE' });
    s.run.mockResolvedValue({ state: 'UNAVAILABLE' });
    expect(await s.handle(request(), sender)).toEqual({ state: 'UNAVAILABLE' });
    s.gate.invalidate();
  });
});
