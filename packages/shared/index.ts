/** Cloud preferences cannot change sender, origin, service or authorization rules. */
export interface Settings {
  autofillEnabled: boolean;
}
export const defaultSettings: Settings = { autofillEnabled: false };
export type ProviderStatus =
  | 'DISCONNECTED'
  | 'CONNECTED'
  | 'RECONNECT_REQUIRED';
export interface InstallationReport {
  installationId: string;
  providerStatus: ProviderStatus;
}
export interface Installation extends InstallationReport {
  lastSeenAt: number;
}
export const installationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function parseSettings(value: unknown): Settings | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).length !== 1 ||
    !('autofillEnabled' in value) ||
    typeof value.autofillEnabled !== 'boolean'
  )
    return null;
  return { autofillEnabled: value.autofillEnabled };
}
export function parseReport(value: unknown): InstallationReport | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).length !== 2 ||
    !('installationId' in value) ||
    typeof value.installationId !== 'string' ||
    !installationIdPattern.test(value.installationId) ||
    !('providerStatus' in value) ||
    typeof value.providerStatus !== 'string' ||
    !['DISCONNECTED', 'CONNECTED', 'RECONNECT_REQUIRED'].includes(
      value.providerStatus,
    )
  )
    return null;
  return {
    installationId: value.installationId,
    providerStatus: value.providerStatus as ProviderStatus,
  };
}
/** Server receipt time describes a report, never a current token guarantee. */
export function providerReportLabel(report: Installation, now: number): string {
  const age = now - report.lastSeenAt;
  if (
    !Number.isSafeInteger(report.lastSeenAt) ||
    !Number.isFinite(now) ||
    age < 0
  )
    return 'Device report time unavailable; current Gmail connection unknown.';
  if (age >= 5 * 60_000)
    return 'Stale device report; current Gmail connection unknown.';
  return `Device reported ${report.providerStatus.toLowerCase().replaceAll('_', ' ')}; current Gmail connection unverified.`;
}

export * from './activity';
