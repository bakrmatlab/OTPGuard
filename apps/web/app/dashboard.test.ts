import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivityState, Dashboard, DeviceReports } from './dashboard';
const id = '11111111-1111-4111-8111-111111111111';
function devices(lastSeenAt: number, observedAt = 600_000) {
  return renderToStaticMarkup(
    createElement(DeviceReports, {
      state: {
        kind: 'ready',
        observedAt,
        installations: [
          { installationId: id, providerStatus: 'CONNECTED', lastSeenAt },
        ],
      },
    }),
  );
}
describe('dashboard presentation without live transport', () => {
  it('keeps missing cloud data distinct from empty records and opt-out', () => {
    for (const kind of [
      'unconfigured',
      'loading',
      'error',
      'opt-out',
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(DeviceReports, { state: { kind } }),
      );
      expect(html).not.toContain('No device reports yet');
      expect(html).toContain('role="status"');
      expect(html).toContain(`aria-busy="${kind === 'loading'}"`);
    }
    expect(
      renderToStaticMarkup(
        createElement(DeviceReports, {
          state: { kind: 'ready', installations: [], observedAt: 600_000 },
        }),
      ),
    ).toContain('No device reports yet');
  });
  it('shows receipt time and age without claiming current token validity', () => {
    expect(devices(599_999)).toContain('less than a minute ago');
    expect(devices(540_000)).toContain('1 minute ago');
    expect(devices(300_001)).toContain('current Gmail connection unverified');
    expect(devices(300_000)).toContain('Stale device report');
    expect(devices(300_000)).toContain('5 minutes ago');
    expect(devices(300_000)).toContain('1970-01-01T00:05:00.000Z');
    for (const time of [600_001, NaN, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
      const html = devices(time);
      expect(html).toContain('Last report time unavailable');
      expect(html).not.toContain('<time');
    }
  });
  it('distinguishes unavailable, pending, failed, opted-out and empty activity', () => {
    const titles = [
      'Cloud activity unavailable',
      'Checking cloud activity',
      'Cloud activity could not be loaded',
      'Cloud history is off',
      'No retained cloud activity',
    ];
    for (const [index, kind] of (
      ['unconfigured', 'loading', 'error', 'opt-out', 'empty'] as const
    ).entries()) {
      const html = renderToStaticMarkup(createElement(ActivityState, { kind }));
      expect(html).toContain(titles[index]);
      expect(html).toContain(`aria-busy="${kind === 'loading'}"`);
    }
  });
  it('renders browser management controls without pretending to have local data', () => {
    const html = renderToStaticMarkup(createElement(Dashboard));
    expect(html).toContain('connect this browser');
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
