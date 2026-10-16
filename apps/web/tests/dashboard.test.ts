import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dashboard } from '../app/dashboard';
const id = '11111111-1111-4111-8111-111111111111';
describe('dashboard presentation without live transport', () => {
  it('renders browser management controls without pretending to have local data', () => {
    const html = renderToStaticMarkup(createElement(Dashboard));
    expect(html).toContain('Step 1 of 4');
    expect(html).toContain('Sign in to OTPGuard');
    expect(html).toContain('Automatic finding');
    expect(html).toContain('Block site');
    expect(html).toContain('Export local history');
    expect(html).toContain('Delete local history');
    expect(html).toContain('Account authentication is unconfigured.');
    expect(html).not.toContain('cannot read unsynchronized');
    expect(html).not.toContain('Example connected');
    expect(html).not.toContain(id);
  });
});
