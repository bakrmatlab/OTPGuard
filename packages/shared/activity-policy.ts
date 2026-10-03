/** No exemption or approved assessment for Gmail-derived cloud events established.
 * This is a code gate, never an environment toggle or user preference.
 */
export function cloudActivityPolicyApproved(): boolean {
  return false;
}
