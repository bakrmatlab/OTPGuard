import { boundedJson } from './transport';
import type { KeyResolver } from '../../../packages/security/dkim';

/** Google HTTPS resolver is an explicit pilot trust dependency. AD=false is not
 * claimed as DNSSEC authentication. No email, recipient, token or code is sent.
 */
export function createDkimResolver(fetcher: typeof fetch = fetch): KeyResolver {
  return async (name, signal) => {
    if (!/^[a-z0-9_-]+\._domainkey\.[a-z0-9.-]+$/.test(name)) throw Error();
    const url = new URL('https://dns.google/resolve');
    url.searchParams.set('name', name);
    url.searchParams.set('type', 'TXT');
    url.searchParams.set('cd', 'false');
    url.searchParams.set('edns_client_subnet', '0.0.0.0/0');
    const response = await fetcher(url.href, {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Error();
    }
    const data = (await boundedJson(response, 16384)) as {
      Status?: number;
      TC?: boolean;
      CD?: boolean;
      Question?: { name: string; type: number }[];
      Answer?: { name: string; type: number; data: string }[];
    };
    const canonical = (n: string) => n.toLowerCase().replace(/\.$/, '');
    if (
      data.Status !== 0 ||
      data.TC !== false ||
      data.CD !== false ||
      data.Question?.length !== 1 ||
      canonical(data.Question[0]!.name) !== name ||
      data.Question[0]!.type !== 16 ||
      !Array.isArray(data.Answer) ||
      data.Answer.length > 10
    )
      throw Error();
    let target = name;
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      if (seen.has(target)) throw Error();
      seen.add(target);
      const answers = data.Answer.filter((a) => canonical(a.name) === target);
      const cnames = answers.filter((a) => a.type === 5);
      const texts = answers.filter((a) => a.type === 16);
      if (cnames.length) {
        if (cnames.length !== 1 || texts.length) throw Error();
        target = canonical(cnames[0]!.data);
        if (!/^[a-z0-9.-]{1,253}$/.test(target)) throw Error();
        continue;
      }
      if (texts.length !== 1) throw Error();
      const value = texts[0]!.data;
      // Current API returns ordinary TXT data unquoted; older documented multi-
      // string records use quoted chunks. Accept either without DNS escape guessing.
      const result =
        /^[\x20-\x7e]+$/.test(value) && !/['"\\]/.test(value)
          ? value
          : /^(?:"[^"\\]*"\s*)+$/.test(value)
            ? [...value.matchAll(/"([^"\\]*)"/g)].map((m) => m[1]).join('')
            : '';
      if (!result) throw Error();
      if (result.length > 8192) throw Error();
      return [result];
    }
    throw Error();
  };
}
