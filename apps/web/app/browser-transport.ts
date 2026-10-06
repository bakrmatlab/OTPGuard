import domainAuth from '../../../configuration/domain-auth.json';
import type {
  BrowserAction,
  BrowserResponse,
} from '../../../packages/shared/browser-management';
interface Runtime {
  lastError?: { message?: string };
  sendMessage(
    id: string,
    message: unknown,
    callback: (response: BrowserResponse | undefined) => void,
  ): void;
}
export function sendBrowserAction(
  action: BrowserAction,
  userId: string,
  sessionId: string,
) {
  return new Promise<BrowserResponse>((resolve, reject) => {
    const runtime = (window as Window & { chrome?: { runtime?: Runtime } })
      .chrome?.runtime;
    if (!runtime?.sendMessage) return reject(new Error('EXTENSION_MISSING'));
    const timer = setTimeout(() => reject(new Error('TIMED_OUT')), 90_000);
    try {
      runtime.sendMessage(
        domainAuth.extensionId,
        { version: 1, userId, sessionId, action },
        (value) => {
          clearTimeout(timer);
          if (runtime.lastError || !value)
            reject(new Error('EXTENSION_MISSING'));
          else resolve(value);
        },
      );
    } catch {
      clearTimeout(timer);
      reject(new Error('EXTENSION_MISSING'));
    }
  });
}
