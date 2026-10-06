import { identifier } from './protocol';
import type { Context } from './coordinator';

/** Volatile, one-use intent. It authorizes a scan, never release of a code. */
export function createEmailRecovery(deps: {
  now(): number;
  id(): string;
  current(context: Context): Promise<boolean>;
  scan(context: Context, groupId: string): Promise<boolean>;
}) {
  let pending:
    | {
        requestId: string;
        context: Context;
        groupId: string;
        expiresAt: number;
      }
    | undefined;
  return {
    offer(context: Context, groupId: unknown) {
      if (
        !identifier(groupId) ||
        !context.accountSession ||
        !context.accountId ||
        !context.mailboxId
      )
        return false;
      pending = {
        requestId: deps.id(),
        context: { ...context },
        groupId,
        expiresAt: deps.now() + 30000,
      };
      return true;
    },
    clear() {
      pending = undefined;
    },
    status() {
      if (pending && deps.now() >= pending.expiresAt) pending = undefined;
      return pending
        ? {
            state: 'EMAIL_CONFIRMATION_REQUIRED' as const,
            requestId: pending.requestId,
            expiresAt: pending.expiresAt,
          }
        : null;
    },
    async confirm(requestId: unknown) {
      const selected = pending;
      if (!selected || requestId !== selected.requestId) return false;
      let current = false;
      try {
        current = await deps.current(selected.context);
      } catch {
        /* refuse */
      }
      if (
        pending !== selected ||
        !current ||
        deps.now() >= selected.expiresAt
      ) {
        if (pending === selected) pending = undefined;
        return false;
      }
      pending = undefined;
      return deps.scan(selected.context, selected.groupId).catch(() => false);
    },
  };
}
