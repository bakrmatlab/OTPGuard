import type {
  BrowserAction,
  BrowserRequest,
  BrowserResponse,
} from '../../packages/shared/browser-management';
import type { AccountGate } from './account/gate';
import { canonicalBlock } from './settings/local';
export interface WebsiteSender {
  id?: string | undefined;
  url?: string | undefined;
  origin?: string | undefined;
  frameId?: number | undefined;
  documentId?: string | undefined;
  tab?: { id?: number | undefined } | undefined;
}
export function parseBrowserRequest(value: unknown): BrowserRequest | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).length !== 4 ||
    !('version' in value) ||
    value.version !== 1 ||
    !('userId' in value) ||
    typeof value.userId !== 'string' ||
    !/^user_[A-Za-z0-9]{1,128}$/.test(value.userId) ||
    !('sessionId' in value) ||
    typeof value.sessionId !== 'string' ||
    !/^sess_[A-Za-z0-9]{1,128}$/.test(value.sessionId) ||
    !('action' in value)
  )
    return null;
  const a = value.action;
  if (
    !a ||
    typeof a !== 'object' ||
    !('type' in a) ||
    typeof a.type !== 'string'
  )
    return null;
  const keys = Object.keys(a).length;
  let action: BrowserAction;
  if (
    keys === 1 &&
    [
      'browser-status',
      'gmail-connect',
      'gmail-disconnect',
      'history-export',
      'history-delete',
      'open-options',
    ].includes(String(a.type))
  )
    action = { type: a.type } as BrowserAction;
  else if (
    a.type === 'settings-autofill' &&
    keys === 2 &&
    'enabled' in a &&
    typeof a.enabled === 'boolean'
  )
    action = { type: a.type, enabled: a.enabled };
  else if (
    a.type === 'settings-block' &&
    keys === 3 &&
    'origin' in a &&
    typeof a.origin === 'string' &&
    canonicalBlock(a.origin) &&
    'blocked' in a &&
    typeof a.blocked === 'boolean'
  )
    action = { type: a.type, origin: a.origin, blocked: a.blocked };
  else return null;
  return {
    version: 1,
    userId: value.userId,
    sessionId: value.sessionId,
    action,
  };
}
export function websiteSender(
  sender: WebsiteSender,
  origin: string | undefined,
) {
  if (
    !origin ||
    sender.id ||
    sender.frameId !== 0 ||
    !Number.isSafeInteger(sender.tab?.id) ||
    !sender.documentId ||
    sender.origin !== origin
  )
    return false;
  try {
    const url = new URL(sender.url ?? '');
    return (
      url.origin === origin &&
      url.pathname === '/dashboard' &&
      !url.search &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
/** One in-flight request, exact top-level document, fresh shared session before
 * work and before responding. Website never receives popup pipeline authority. */
export function createWebsiteManagement(deps: {
  origin: string | undefined;
  gate: AccountGate;
  documentCurrent(sender: WebsiteSender): Promise<boolean>;
  run(
    action: BrowserAction,
    current: () => Promise<boolean>,
  ): Promise<BrowserResponse>;
}) {
  let busy = false;
  return async (
    value: unknown,
    sender: WebsiteSender,
  ): Promise<BrowserResponse> => {
    const request = parseBrowserRequest(value);
    if (!request || !websiteSender(sender, deps.origin))
      return { state: 'REFUSED' };
    if (busy) return { state: 'BUSY' };
    busy = true;
    const deadline = Date.now() + 60_000;
    try {
      const binding = await deps.gate.refresh(true);
      if (
        !binding ||
        binding.userId !== request.userId ||
        binding.sessionId !== request.sessionId
      )
        return { state: 'REFUSED' };
      const current = async () => {
        if (Date.now() >= deadline || !(await deps.documentCurrent(sender)))
          return false;
        const authorized = await deps.gate.current(binding);
        return (
          authorized &&
          deps.gate.matches(binding) &&
          Date.now() < deadline &&
          (await deps.documentCurrent(sender))
        );
      };
      if (!(await current())) return { state: 'REFUSED' };
      const response = await deps.run(request.action, current);
      return (await current()) ? response : { state: 'REFUSED' };
    } catch {
      return { state: 'UNAVAILABLE' };
    } finally {
      busy = false;
    }
  };
}
