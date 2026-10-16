/** Preferences cannot change sender, origin, service or authorization rules. */
export interface Settings {
  autofillEnabled: boolean;
}
export const defaultSettings: Settings = { autofillEnabled: false };
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

export * from './activity';
