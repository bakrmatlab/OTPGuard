/* eslint-disable no-control-regex -- Untrusted address syntax must reject controls. */
/** Bounded RFC 5322 subset for untrusted matching hints, never delivery/trust proof.
 * null means incomplete/unsupported syntax: callers must not use a partial list.
 * Obsolete routes, domain literals and internationalized addr-specs are unsupported.
 */
const atom = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const dotAtom = new RegExp(`^${atom}(?:\\.${atom})*$`);
const quoted = /^"(?:[\x20-\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])*"$/;
const domainName =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

/** Exact addr-spec only. Preserve local-part case; canonicalize quoting and domain. */
export function parseMailboxAddress(value: string): string | null {
  if (value.length > 320 || /[^\x20-\x7e]/.test(value)) return null;
  const match = /^("(?:[^"\\]|\\.)*"|[^@\s]+)[ ]*@[ ]*([^@\s]+)$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const localSyntax = match[1]!;
  const domain = match[2]!;
  if (!domainName.test(domain) || domain.length > 253) return null;
  if (!dotAtom.test(localSyntax) && !quoted.test(localSyntax)) return null;
  const local = localSyntax.startsWith('"')
    ? localSyntax.slice(1, -1).replace(/\\(.)/g, '$1')
    : localSyntax;
  if (!local.length || local.length > 64) return null;
  const spelling = dotAtom.test(local)
    ? local
    : '"' + local.replace(/["\\]/g, '\\$&') + '"';
  return spelling + '@' + domain.toLowerCase();
}

/** Remove nested comments without ever joining address fragments. */
function withoutComments(value: string): string | null {
  if (value.length > 8192) return null;
  value = value.replace(/\r\n[ \t]+/g, ' ');
  if (/[\x00-\x08\x0a-\x1f\x7f]/.test(value)) return null;
  let depth = 0;
  let inQuote = false;
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch === '\\') {
      if ((!depth && !inQuote) || i + 1 === value.length) return null;
      const next = value[++i]!;
      if (!depth) result += ch + next;
    } else if (depth) {
      if (ch === '(' && ++depth > 8) return null;
      if (ch === ')') depth--;
    } else if (ch === '"') {
      inQuote = !inQuote;
      result += ch;
    } else if (!inQuote && ch === '(') {
      depth = 1;
      result += ' ';
    } else if (!inQuote && ch === ')') {
      return null;
    } else result += ch;
  }
  return depth || inQuote ? null : result;
}

/** Display/group names are inert phrases; quoted email-like text is never an address. */
function phrase(value: string): boolean {
  let word = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (/[ \t]/.test(ch)) continue;
    word = true;
    if (ch === '"') {
      let closed = false;
      while (++i < value.length) {
        if (value[i] === '\\') i++;
        else if (value[i] === '"') {
          closed = true;
          break;
        }
      }
      if (!closed) return false;
    } else if (!/[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.\u0080-\uffff]/.test(ch))
      return false;
  }
  return word;
}
function mailbox(value: string): string | null {
  value = value.trim();
  // Angle brackets inside a quoted local/display name are inert.
  let inQuote = false;
  let open = -1;
  let close = -1;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '\\' && inQuote) i++;
    else if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && ch === '<') {
      if (open !== -1) return null;
      open = i;
    } else if (!inQuote && ch === '>') {
      if (close !== -1 || open === -1) return null;
      close = i;
    }
  }
  if (open === -1) return close === -1 ? parseMailboxAddress(value) : null;
  if (close < open || value.slice(close + 1).trim()) return null;
  const name = value.slice(0, open).trim();
  if (name && !phrase(name)) return null;
  return parseMailboxAddress(value.slice(open + 1, close).trim());
}

export function parseAddressList(value: string): string[] | null {
  const clean = withoutComments(value);
  if (clean === null || !clean.trim()) return null;
  const addresses: string[] = [];
  let start = 0;
  let inQuote = false;
  let inAngle = false;
  let inGroup = false;
  let endedGroup = false;
  let entries = 0;
  let undisclosed = false;
  const add = (end: number) => {
    if (++entries > 100) return false;
    const address = mailbox(clean.slice(start, end));
    if (!address) return false;
    addresses.push(address);
    return true;
  };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (endedGroup && !/[ \t,]/.test(ch)) return null;
    if (ch === '\\' && inQuote) {
      i++;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    if (ch === '<') {
      if (inAngle || endedGroup) return null;
      inAngle = true;
      continue;
    }
    if (ch === '>') {
      if (!inAngle) return null;
      inAngle = false;
      continue;
    }
    if (inAngle) continue;
    if (ch === ':') {
      if (inGroup || endedGroup || !phrase(clean.slice(start, i))) return null;
      inGroup = true;
      start = i + 1;
    } else if (ch === ';') {
      if (!inGroup) return null;
      if (clean.slice(start, i).trim()) {
        if (!add(i)) return null;
      }
      // An empty group is valid, but an empty member after a comma is not.
      else if (clean.slice(0, i).trimEnd().endsWith(',')) return null;
      else undisclosed = true;
      inGroup = false;
      endedGroup = true;
      start = i + 1;
    } else if (ch === ',') {
      if (endedGroup) {
        if (clean.slice(start, i).trim()) return null;
      } else if (!add(i)) return null;
      endedGroup = false;
      start = i + 1;
    } else if (endedGroup && !/[ \t]/.test(ch)) return null;
  }
  if (inQuote || inAngle || inGroup) return null;
  if (!endedGroup && !add(clean.length)) return null;
  return undisclosed ? [] : [...new Set(addresses)];
}

/** Nearby rendered prose is not an address-list header. Only complete standalone
 * address tokens are hints; a malformed/masked/unsupported token makes it uncertain.
 * Quoted local-parts with spaces and prose-wrapped addresses are deliberately omitted.
 */
export function displayedRecipient(text: string): string | undefined {
  if (
    text.length > 4000 ||
    /[*•\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(text)
  )
    return undefined;
  const addresses: string[] = [];
  for (const token of text.split(/\s+/)) {
    if (!token.includes('@')) continue;
    const address = parseMailboxAddress(token);
    if (!address) return undefined;
    addresses.push(address);
  }
  return addresses.length && new Set(addresses).size === 1
    ? addresses[0]
    : undefined;
}
