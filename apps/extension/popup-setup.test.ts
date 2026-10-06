import { expect, it } from 'vitest';
it('names setup actions and keeps live offers limited to Fill', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PopupView } = await import('./popup-view');
  const render = (state: string, account: string, siteAccess: boolean) =>
    renderToStaticMarkup(
      createElement(PopupView, {
        pipeline: { state, requestId: 'synthetic' },
        account,
        siteAccess,
        website: 'https://otpguard.net/dashboard',
        onFill: () => {},
        onRetry: () => {},
        onSetup: () => {},
      }),
    );
  expect(render('IDLE', 'SIGNED_IN', false)).toContain(
    'Enable website access</button>',
  );
  expect(render('MAILBOX_UNAVAILABLE', 'SIGNED_IN', true)).toContain(
    'Connect Gmail</button>',
  );
  expect(render('IDLE', 'SIGN_IN_REQUIRED', true)).toContain('>Sign in</a>');
  expect(render('READY', 'SIGNED_IN', true)).not.toContain(
    'Enable website access</button>',
  );
});
