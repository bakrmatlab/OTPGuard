import { afterEach, expect, it, vi } from 'vitest';
import {
  createCoordinator,
  type Adapter,
  type Envelope,
} from '../apps/extension/pipeline/coordinator';
import type {
  Binding,
  WorkerMessage,
} from '../apps/extension/pipeline/protocol';

afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  const envelope: Envelope = {
    messageId: 'synthetic',
    mailboxId: 'mailbox',
    receivedAt: 100000,
    sender: { status: 'unknown' },
    email: { subject: 'Login code', text: 'Your code is 003719' },
  };
  const sent: WorkerMessage[] = [];
  const adapter: Adapter = {
    mode: 'user-confirmed',
    registry: [],
    now: Date.now,
    id: () => 'request',
    context: async () => ({
      accountId: 'account',
      mailboxId: 'mailbox',
      tabId: 1,
      documentId: 'doc',
      origin: 'https://fixture.invalid',
      browserUrl: 'https://fixture.invalid/login',
      policyUrl: 'https://fixture.invalid/login',
      serviceId: 'generic',
      foreground: true,
    }),
    current: async () => true,
    retrieve: async () => [envelope],
    confirm: async () => true,
    reserve: async () => true,
    send: async (_context, message) => {
      sent.push(message);
      return true;
    },
  };
  const detect = {
    type: 'detect',
    groupId: 'fields',
    expectedLength: 6,
    emailFlow: true,
    groupCount: 1,
  };
  return { adapter, detect, sent, envelope };
}
it('late delivery and authority checks leave thirty seconds to choose Fill', async () => {
  const t = setup();
  t.adapter.retrieve = async () => {
    await new Promise((r) => setTimeout(r, 52000));
    return [t.envelope];
  };
  let reads = 0;
  t.adapter.current = async () => {
    if (++reads === 1) await new Promise((r) => setTimeout(r, 5000));
    return true;
  };
  let binding!: Binding;
  let click!: (value: boolean) => void;
  t.adapter.confirm = async (_context, offered) => {
    binding = offered;
    return new Promise((r) => {
      click = r;
    });
  };
  const c = createCoordinator(t.adapter);
  try {
    const result = c.handle(t.detect, {});
    await vi.advanceTimersByTimeAsync(57000);
    expect(binding.expiresAt - Date.now()).toBe(30000);
    await vi.advanceTimersByTimeAsync(20000);
    click(true);
    expect(await result).toEqual({ state: 'FILLED' });
    expect(t.sent.map((m) => m.type)).toEqual(['prepare', 'release']);
  } finally {
    c.dispose();
  }
});

it('a late Fill click has a bounded release budget for fresh authority checks', async () => {
  const t = setup();
  let click!: (value: boolean) => void;
  t.adapter.confirm = async () =>
    new Promise((r) => {
      click = r;
    });
  let slow = false;
  t.adapter.current = async () => {
    if (slow) await new Promise((r) => setTimeout(r, 2000));
    return true;
  };
  const c = createCoordinator(t.adapter);
  try {
    const result = c.handle(t.detect, {});
    await vi.advanceTimersByTimeAsync(29000);
    slow = true;
    click(true);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await result).toEqual({ state: 'FILLED' });
    expect(t.sent.map((m) => m.type)).toEqual(['prepare', 'release']);
  } finally {
    c.dispose();
  }
});

it('a stalled authority read settles at the search deadline and cannot resume a release', async () => {
  const t = setup();
  let finish!: (value: boolean) => void;
  t.adapter.current = async () =>
    new Promise((r) => {
      finish = r;
    });
  const c = createCoordinator(t.adapter);
  try {
    let outcome: unknown;
    const result = c.handle(t.detect, {}).then((value) => {
      outcome = value;
    });
    await vi.advanceTimersByTimeAsync(60000);
    expect(outcome).toEqual({ state: 'CANCELLED' });
    finish(true);
    await result;
    expect(t.sent).toEqual([]);
  } finally {
    c.dispose();
  }
});

it.each(['current', 'block'] as const)(
  'a timely Fill click cannot authorize changed %s',
  async (change) => {
    const t = setup();
    let click!: (value: boolean) => void;
    t.adapter.confirm = async () =>
      new Promise((r) => {
        click = r;
      });
    let current = true;
    t.adapter.current = async () => current;
    let blocked = false;
    t.adapter.settings = () => ({
      autofillEnabled: true,
      blockedOrigins: blocked ? ['https://fixture.invalid'] : [],
    });
    const c = createCoordinator(t.adapter);
    try {
      const result = c.handle(t.detect, {});
      await vi.advanceTimersByTimeAsync(29000);
      if (change === 'block') blocked = true;
      else current = false;
      click(true);
      expect((await result).state).not.toBe('FILLED');
      expect(t.sent).toEqual([]);
    } finally {
      c.dispose();
    }
  },
);

it.each(['confirmation', 'release-current', 'prepare', 'reservation'] as const)(
  'settles stalled %s within its own phase and ignores a late success',
  async (stage) => {
    const t = setup();
    let finish!: (value: boolean) => void;
    const stalled = () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      });
    if (stage === 'confirmation') t.adapter.confirm = stalled;
    if (stage === 'prepare')
      t.adapter.send = async (_context, message) => {
        t.sent.push(message);
        return message.type === 'prepare' ? stalled() : true;
      };
    if (stage === 'reservation') t.adapter.reserve = stalled;
    let reads = 0;
    if (stage === 'release-current')
      t.adapter.current = async () => (++reads === 1 ? true : stalled());
    const c = createCoordinator(t.adapter);
    try {
      let outcome: unknown;
      const result = c.handle(t.detect, {}).then((value) => {
        outcome = value;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(finish).toBeTypeOf('function');
      await vi.advanceTimersByTimeAsync(
        stage === 'confirmation' ? 30000 : 15000,
      );
      expect(outcome).toEqual({ state: 'CANCELLED' });
      finish(true);
      await result;
      await vi.advanceTimersByTimeAsync(0);
      expect(t.sent.some((m) => m.type === 'release')).toBe(false);
    } finally {
      c.dispose();
    }
  },
);

it('an expired confirmation cannot create a release budget even if its adapter says yes', async () => {
  const t = setup();
  t.adapter.confirm = async () => {
    vi.setSystemTime(130000);
    return true;
  };
  const c = createCoordinator(t.adapter);
  try {
    expect(await c.handle(t.detect, {})).toEqual({ state: 'CANCELLED' });
    expect(t.sent).toEqual([]);
  } finally {
    c.dispose();
  }
});

it.each([
  { confirmation: undefined, deadline: 160001, now: 120000 },
  { confirmation: { offeredAt: 160000 }, deadline: 190000, now: 160000 },
  { confirmation: { offeredAt: 120000 }, deadline: 150001, now: 140000 },
  {
    confirmation: { offeredAt: 120000, clickedAt: 150000 },
    deadline: 165000,
    now: 150000,
  },
  {
    confirmation: { offeredAt: 120000, clickedAt: 149000 },
    deadline: 164001,
    now: 150000,
  },
  {
    confirmation: { offeredAt: 120000, clickedAt: 119999 },
    deadline: 130000,
    now: 125000,
  },
  {
    confirmation: { offeredAt: 120000, clickedAt: 149000 },
    deadline: 164000,
    now: 140000,
  },
])(
  'generic policy refuses an invalid phase timeline: $deadline at $now',
  async ({ confirmation, deadline, now }) => {
    const { assessGenericCandidate } =
      await import('../packages/security/generic');
    const { parseGenericCode } = await import('../packages/otp');
    const t = setup();
    expect(
      assessGenericCandidate({
        serviceId: 'generic',
        now,
        locallyBlocked: false,
        request: {
          mailboxId: 'mailbox',
          startedAt: 100000,
          deadline,
          ...(confirmation ? { confirmation } : {}),
          url: 'https://fixture.invalid',
          topLevel: true,
          current: true,
          foreground: true,
          emailFlow: true,
          purpose: 'sign-in',
          expectedLength: 6,
          competingChallenges: 0,
        },
        messages: [
          { ...t.envelope, parsed: parseGenericCode(t.envelope.email) },
        ],
      }),
    ).toEqual({ state: 'UNKNOWN', reason: 'request' });
  },
);

it('fresh release checks reject a candidate that ages out while confirmation waits', async () => {
  const t = setup();
  let click!: (value: boolean) => void;
  t.adapter.confirm = async () =>
    new Promise((resolve) => {
      click = resolve;
    });
  let slow = false;
  t.adapter.current = async () => {
    if (slow) await new Promise((resolve) => setTimeout(resolve, 2000));
    return true;
  };
  const c = createCoordinator(t.adapter);
  try {
    await c.handle({ type: 'challenge' }, {});
    vi.setSystemTime(370000);
    const result = c.handle(t.detect, {});
    await vi.advanceTimersByTimeAsync(29000);
    slow = true;
    click(true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await result).toEqual({ state: 'UNKNOWN', reason: 'freshness' });
    expect(t.sent.some((message) => message.type === 'release')).toBe(false);
  } finally {
    c.dispose();
  }
});
