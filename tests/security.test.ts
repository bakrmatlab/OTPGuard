import { describe, expect, it } from 'vitest';
import { normalizeOrigin } from '../packages/security';

describe('origin canonicalization', () => {
  it('canonicalizes case, default port and IDNA without suffix matching', () => {
    expect(normalizeOrigin('https://LOGIN.LANTERN.EXAMPLE:443/path')).toBe(
      'https://login.lantern.example',
    );
    expect(normalizeOrigin('https://bücher.example')).toBe(
      'https://xn--bcher-kva.example',
    );
  });
});
