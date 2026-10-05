import { afterEach, expect, it, vi } from 'vitest';
import { createAccountGate } from '../apps/extension/account/gate';
import { createGmailLifecycle } from '../apps/extension/gmail/lifecycle';
import { GMAIL_SCOPE } from '../apps/extension/gmail/config';
import { createGmailTransport } from '../apps/extension/gmail/transport';
import { createGmailPageCoordinator } from '../apps/extension/gmail/retrieval';

afterEach(() => vi.useRealTimers());
it.each(
  (['account', 'mailbox', 'page'] as const).flatMap((stage) =>
    (['deadline', 'navigation', 'continue'] as const).map((action) => ({
      stage,
      action,
    })),
  ),
)(
  'handles $action during $stage admission after a completed fill',
  async ({ stage, action }) => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    let finishRead!: () => void;
    const wait = () =>
      new Promise<void>((resolve) => {
        finishRead = resolve;
      });
    let stalled = false;
    const gate = createAccountGate(async () => {
      if (stalled && stage === 'account') await wait();
      return {
        userId: 'user',
        sessionId: 'session',
        expiresAt: 1000000,
        label: 'Synthetic',
      };
    });
    const mailbox = createGmailLifecycle(
      {
        token: async () => {
          if (stalled && stage === 'mailbox') await wait();
          return { token: 'synthetic', grantedScopes: [GMAIL_SCOPE] };
        },
        profile: async () => 'person@fixture.invalid',
        remove: async () => {},
        clear: async () => {},
        revoke: async () => true,
      },
      true,
    );
    await mailbox.connect();
    let origin = 'https://www.canva.com';
    let documentId = 'first-document';
    const fetcher = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            new URL(url).searchParams.has('format')
              ? {
                  id: 'a',
                  internalDate: '100000',
                  raw: Buffer.from(
                    'Subject: Login code\r\nContent-Type: text/plain\r\n\r\nYour code is 003719',
                  ).toString('base64url'),
                }
              : { messages: [{ id: 'a' }] },
          ),
        ),
    );
    const send = vi.fn(async () => true);
    const cancelled = vi.fn();
    const coordinator = createGmailPageCoordinator(
      {
        now: Date.now,
        id: () => documentId,
        settings: () => ({ autofillEnabled: true, blockedOrigins: [] }),
        context: async () => {
          if (stalled && stage === 'page') await wait();
          return {
            accountId: '',
            mailboxId: 'person@fixture.invalid',
            tabId: 1,
            documentId,
            origin,
            browserUrl: origin + '/sign-in/factor-one',
            policyUrl: origin + '/sign-in/factor-one',
            serviceId: 'generic',
            foreground: true,
          };
        },
        current: async () => true,
        confirm: async () => true,
        send,
        cancelled,
      },
      gate,
      mailbox,
      createGmailTransport(fetcher),
    );
    const sender: chrome.runtime.MessageSender = {
      tab: {
        id: 1,
        index: 0,
        pinned: false,
        highlighted: true,
        windowId: 1,
        active: true,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        frozen: false,
        groupId: -1,
      },
    };
    const detect = {
      type: 'detect',
      groupId: 'fields',
      expectedLength: 6,
      emailFlow: true,
      groupCount: 1,
    };
    try {
      const first = coordinator.handle(detect, sender);
      await vi.advanceTimersByTimeAsync(0);
      expect(await first).toEqual({ state: 'FILLED' });
      expect(send).toHaveBeenCalledTimes(2);
      origin = 'https://unfamiliar.fixture.invalid';
      documentId = 'second-document';
      stalled = true;
      let outcome: unknown;
      const second = coordinator.handle(detect, sender).then((value) => {
        outcome = value;
      });
      await vi.advanceTimersByTimeAsync(action === 'deadline' ? 60000 : 2000);
      if (action === 'navigation') {
        coordinator.cancelTab(1);
        await vi.advanceTimersByTimeAsync(0);
      }
      if (action !== 'continue') {
        expect(outcome).toEqual({ state: 'CANCELLED' });
        expect(cancelled).toHaveBeenLastCalledWith(action);
      } else expect(outcome).toBeUndefined();
      expect(fetcher).toHaveBeenCalledTimes(2);
      stalled = false;
      finishRead();
      await vi.advanceTimersByTimeAsync(0);
      await second;
      expect(outcome).toEqual({
        state: action === 'continue' ? 'FILLED' : 'CANCELLED',
      });
      expect(send).toHaveBeenCalledTimes(action === 'continue' ? 4 : 2);
    } finally {
      coordinator.dispose();
      gate.invalidate();
      mailbox.invalidate();
    }
  },
);
