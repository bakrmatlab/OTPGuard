/** Metadata-only browser management protocol. Never carries codes or credentials. */
export type BrowserAction =
  | { type: 'browser-status' }
  | { type: 'settings-autofill'; enabled: boolean }
  | { type: 'settings-block'; origin: string; blocked: boolean }
  | {
      type:
        | 'gmail-connect'
        | 'gmail-disconnect'
        | 'history-export'
        | 'history-delete'
        | 'open-options';
    };
export interface BrowserRequest {
  version: 1;
  userId: string;
  sessionId: string;
  action: BrowserAction;
}
export interface BrowserSnapshot {
  settings: {
    state: string;
    autofillEnabled: boolean;
    blockedOrigins: readonly string[];
  };
  mailbox: { state: string; mailbox?: string };
  siteAccess: boolean;
  history: {
    state: string;
    count?: number;
    lastAction?: { result: string; reason: string; time: number };
  };
}
export type BrowserResponse =
  | { state: 'CONNECTED'; snapshot: BrowserSnapshot; exportJson?: string }
  | { state: 'REFUSED' | 'BUSY' | 'UNAVAILABLE' };
