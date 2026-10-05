import { createCoordinator, type Adapter } from '../pipeline/coordinator';
import type { AccountGate } from './gate';
/** Future connected adapters must enter through this boundary; mock adapters remain separate. */
export function createConnectedCoordinator(
  adapter: Adapter,
  gate: AccountGate,
) {
  const coordinator = createCoordinator({
    ...adapter,
    async context(sender) {
      adapter.contextFailure?.(null);
      const bound = await gate.refresh(true);
      if (!bound) {
        adapter.contextFailure?.('account');
        return null;
      }
      const context = await adapter.context(sender);
      if (!context) return null;
      if (!(await gate.current(bound))) {
        adapter.contextFailure?.('account');
        return null;
      }
      return { ...context, accountId: bound.userId, accountSession: bound };
    },
    async retrieve(context, signal) {
      if (
        !context.accountSession ||
        signal.aborted ||
        !(await gate.current(context.accountSession)) ||
        signal.aborted
      )
        return null;
      return adapter.retrieve(context, signal);
    },
    async current(context) {
      if (!context.accountSession || !gate.matches(context.accountSession))
        return false;
      if (!(await adapter.current(context))) return false;
      return gate.current(context.accountSession);
    },
  });
  const unsubscribe = gate.subscribe(() =>
    coordinator.cancelAll('account-changed'),
  );
  return {
    ...coordinator,
    dispose() {
      coordinator.dispose();
      unsubscribe();
    },
  };
}
